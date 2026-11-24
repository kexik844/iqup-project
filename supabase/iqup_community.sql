-- Run after iqup_telegram_progress.sql. Existing profiles and purchases are kept.
begin;

alter table public.iqup_telegram_progress add column if not exists updated_at timestamptz;
alter table public.iqup_telegram_progress add column if not exists xp bigint generated always as (
  case when jsonb_typeof(profile->'xp') = 'number'
    then floor(least(greatest((profile->>'xp')::numeric,0),100000000))::bigint
    else 0 end
) stored;
create index if not exists iqup_progress_ranking_idx on public.iqup_telegram_progress(xp desc,telegram_id) where xp > 0;

create table if not exists public.iqup_members (
  telegram_id bigint primary key check (telegram_id between 1 and 4503599627370495),
  display_name text not null check (length(display_name) <= 128),
  hidden boolean not null default false
);
create table if not exists public.iqup_admins (
  telegram_id bigint primary key check (telegram_id between 1 and 4503599627370495)
);
create table if not exists public.iqup_support (
  telegram_id bigint not null check (telegram_id between 1 and 4503599627370495),
  id uuid not null,
  category text not null check (category in ('account','game','shop','other')),
  message text not null check (length(message) between 1 and 1000),
  status text not null default 'open' check (status in ('open','closed')),
  response text check (length(response) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (telegram_id,id)
);
create index if not exists iqup_support_updated_idx on public.iqup_support(updated_at desc);
create table if not exists public.iqup_admin_log (
  id bigint generated always as identity primary key,
  admin_id bigint not null,
  target_id bigint not null,
  action text not null,
  ticket_id uuid,
  created_at timestamptz not null default now()
);

alter table public.iqup_members enable row level security;
alter table public.iqup_admins enable row level security;
alter table public.iqup_support enable row level security;
alter table public.iqup_admin_log enable row level security;
revoke all on public.iqup_members,public.iqup_admins,public.iqup_support,public.iqup_admin_log
  from public,anon,authenticated,service_role;

-- Old clients keep using the same optimistic save contract.
create or replace function public.iqup_save_telegram_progress(owner_id bigint, expected_revision integer, new_profile jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if expected_revision = 0 then
    insert into public.iqup_telegram_progress(telegram_id,profile,updated_at)
    values(owner_id,new_profile,now()) on conflict (telegram_id) do nothing
    returning revision into next_revision;
  else
    update public.iqup_telegram_progress set profile = new_profile,revision = revision + 1,updated_at = now()
    where telegram_id = owner_id and revision = expected_revision returning revision into next_revision;
  end if;
  return next_revision;
end $$;

create or replace function public.iqup_community(actor bigint, operation text, args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  admin boolean := exists(select 1 from public.iqup_admins where telegram_id = actor);
  allowed_category text := args->>'category';
  message_text text := btrim(coalesce(args->>'message',''));
  reply_text text := btrim(coalesce(args->>'response',''));
  wanted_status text := args->>'status';
  search text := lower(left(btrim(coalesce(args->>'search','')),128));
  page_offset integer := least(greatest(coalesce((args->>'offset')::integer,0),0),1000000);
  target bigint;
  ticket uuid;
  output jsonb;
begin
  if operation = 'leaderboard' then
    with ranked as (
      select row_number() over (order by p.xp desc,p.telegram_id) as place,
        p.xp, p.telegram_id,
        case when p.profile->'privacy' = 'false'::jsonb then nullif(m.display_name,'') end as name
      from public.iqup_telegram_progress p
      left join public.iqup_members m using (telegram_id)
      where p.xp > 0 and not coalesce(m.hidden,false)
    )
    select jsonb_build_object(
      'entries',coalesce(jsonb_agg(jsonb_build_object(
        'place',place,'xp',xp,'name',name,'self',coalesce(telegram_id = actor,false)
      ) order by place) filter(where place <= 100),'[]'::jsonb),
      'myPlace',max(place) filter(where telegram_id = actor)
    ) into output from ranked;
    return output;
  end if;
  if actor is null then return '{"error":"forbidden"}'; end if;
  if operation = 'register' then
    insert into public.iqup_members(telegram_id,display_name) values(actor,left(coalesce(args->>'name',''),128))
    on conflict (telegram_id) do update set display_name = excluded.display_name
    where public.iqup_members.display_name is distinct from excluded.display_name;
    return jsonb_build_object('admin',admin);
  end if;
  if operation = 'role' then return jsonb_build_object('admin',admin); end if;
  if operation = 'support' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into output
    from (select id,category,message,status,response,created_at,updated_at from public.iqup_support
      where telegram_id = actor order by updated_at desc,id limit 31 offset page_offset) t;
    return output;
  end if;
  if operation = 'ticket_create' then
    ticket := (args->>'id')::uuid;
    if ticket is null or allowed_category is null or allowed_category not in ('account','game','shop','other')
      or length(message_text) not between 1 and 1000 then return '{"error":"invalid"}'; end if;
    perform pg_advisory_xact_lock(actor);
    if exists(select 1 from public.iqup_support where telegram_id = actor and id = ticket) then return '{"ok":true}'; end if;
    if (select count(*) from public.iqup_support where telegram_id = actor and created_at > now() - interval '1 hour') >= 5
      then return '{"error":"limit"}'; end if;
    insert into public.iqup_support(telegram_id,id,category,message) values(actor,ticket,allowed_category,message_text);
    return '{"ok":true}';
  end if;

  if not admin then return '{"error":"forbidden"}'; end if;
  if operation = 'overview' then
    return jsonb_build_object('players',(select count(*) from public.iqup_members),
      'withXp',(select count(*) from public.iqup_telegram_progress where xp > 0),
      'recent',(select count(*) from public.iqup_telegram_progress where updated_at >= now() - interval '7 days'),
      'open',(select count(*) from public.iqup_support where status = 'open'));
  end if;
  if operation = 'players' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.xp desc,t.id),'[]'::jsonb) into output
    from (select coalesce(p.telegram_id,m.telegram_id)::text as id,m.display_name as name,
       coalesce(p.xp,0) as xp,coalesce(m.hidden,false) as hidden,p.updated_at
       from public.iqup_members m full join public.iqup_telegram_progress p using (telegram_id)
       where strpos(lower(coalesce(m.display_name,'')),search) > 0
          or strpos(coalesce(p.telegram_id,m.telegram_id)::text,search) > 0
       order by xp desc,coalesce(p.telegram_id,m.telegram_id)::text limit 31 offset page_offset) t;
    return output;
  end if;
  if operation = 'queue' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into output
    from (select s.id,s.telegram_id::text as owner,m.display_name as name,s.category,s.message,s.status,s.response,s.created_at,s.updated_at
       from public.iqup_support s left join public.iqup_members m using (telegram_id)
       where (wanted_status is null or s.status = wanted_status)
       order by s.updated_at desc,s.id limit 31 offset page_offset) t;
    return output;
  end if;
  if operation = 'audit' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc),'[]'::jsonb) into output
    from (select id,admin_id::text as actor,target_id::text as target,action,created_at
      from public.iqup_admin_log order by id desc limit 30) t;
    return output;
  end if;
  target := (args->>'owner')::bigint;
  if target is null or target not between 1 and 4503599627370495 then return '{"error":"invalid"}'; end if;
  if operation = 'moderate' then
    if jsonb_typeof(args->'hidden') is distinct from 'boolean' then return '{"error":"invalid"}'; end if;
    if not exists(select 1 from public.iqup_members where telegram_id = target)
      and not exists(select 1 from public.iqup_telegram_progress where telegram_id = target) then return '{"error":"missing"}'; end if;
    insert into public.iqup_members(telegram_id, display_name, hidden) values(target,'',(args->>'hidden')::boolean)
    on conflict (telegram_id) do update set hidden = excluded.hidden
    where public.iqup_members.hidden is distinct from excluded.hidden;
    if found then
      insert into public.iqup_admin_log(admin_id,target_id,action) values(actor,target,case when (args->>'hidden')::boolean then 'hide' else 'show' end);
    end if;
    return '{"ok":true}';
  end if;
  if operation = 'ticket_update' then
    ticket := (args->>'id')::uuid;
    if wanted_status is null or wanted_status not in ('open','closed') or length(reply_text) > 2000
      or args->>'version' is null then return '{"error":"invalid"}'; end if;
    update public.iqup_support set status = wanted_status,response = coalesce(nullif(reply_text,''),response),updated_at = now()
      where telegram_id = target and id = ticket
        and updated_at = (args->>'version')::timestamptz;
    if found then
      insert into public.iqup_admin_log(admin_id,target_id,action,ticket_id) values(actor,target,
        case when wanted_status = 'closed' then 'close' when reply_text <> '' then 'reply' else 'reopen' end,ticket);
    elsif not exists(select 1 from public.iqup_support where telegram_id = target and id = ticket) then
      return '{"error":"missing"}';
    else
      return '{"error":"conflict"}';
    end if;
    return '{"ok":true}';
  end if;
  return '{"error":"invalid"}';
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then return '{"error":"invalid"}';
end $$;
revoke all on function public.iqup_community(bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.iqup_community(bigint,text,jsonb) to service_role;
commit;
