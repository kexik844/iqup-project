-- Additive migration. Existing email-account progress remains in iqup_progress.
begin;

create table if not exists public.iqup_telegram_progress (
  telegram_id bigint primary key check (telegram_id between 1 and 4503599627370495),
  profile jsonb not null check (
    jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 6291456
  ),
  revision integer not null default 1 check (revision > 0)
);

alter table public.iqup_telegram_progress enable row level security;
revoke all on public.iqup_telegram_progress from public, anon, authenticated, service_role;
grant select on public.iqup_telegram_progress to service_role;

create or replace function public.iqup_save_telegram_progress(owner_id bigint, expected_revision integer, new_profile jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  next_revision integer;
begin
  if expected_revision = 0 then
    insert into public.iqup_telegram_progress(telegram_id, profile)
      values (owner_id, new_profile)
      on conflict (telegram_id) do nothing
      returning revision into next_revision;
  else
    update public.iqup_telegram_progress
      set profile = new_profile, revision = revision + 1
      where telegram_id = owner_id and revision = expected_revision
      returning revision into next_revision;
  end if;
  return next_revision;
end;
$$;
revoke all on function public.iqup_save_telegram_progress(bigint, integer, jsonb) from public, anon, authenticated;
grant execute on function public.iqup_save_telegram_progress(bigint, integer, jsonb) to service_role;

commit;
