import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Send, Shield, Trophy } from 'lucide-react';
import { local, type Lang } from './catalog';
import { communityRequest, useCloud } from './cloud';
import { type Profile } from './progress';
import { telegramAppUrl } from './telegram';
import { TelegramCloudError } from './telegram-cloud';
import { l, PageTop } from './ui';

const pageSize = 30;
type Status = 'open'|'closed';
const categories = {
  account:['Аккаунт','Account'],game:['Тренировки','Workouts'],shop:['Магазин и темы','Shop and themes'],other:['Другое','Other'],
} as const;
type Category = keyof typeof categories;
type Ticket = {id:string;category:Category;message:string;status:Status;response:string|null;updated_at:string};
type AdminTicket = Ticket & {owner:string;name:string|null};
type Player = {id:string;name:string|null;xp:number;hidden:boolean;updated_at:string|null};
type Audit = {id:number;actor:string;target:string;action:string;created_at:string};
type Overview = {players:number;withXp:number;recent:number;open:number};
type Ranking = {entries:{place:number;xp:number;name:string|null;self:boolean}[];myPlace:number|null};
type Query<T> = {data?:T;error?:unknown;pending:boolean};
const statusText = (lang:Lang,status:Status) => status === 'open' ? l(lang,'Открыто','Open') : l(lang,'Закрыто','Closed');
const dateText = (lang:Lang,date:string) => new Date(date).toLocaleString(lang,{dateStyle:'short',timeStyle:'short'});
function errorText(lang:Lang,error:unknown) {
  const status = error instanceof TelegramCloudError ? error.status : 0;
  if (status === 401) return l(lang,'Открой IQUP заново из Telegram.','Reopen IQUP from Telegram.');
  if (status === 403) return l(lang,'Доступ ограничен.','Access denied.');
  if (status === 409) return l(lang,'Обращение уже изменилось. Обнови список перед сохранением.','This ticket has changed. Refresh the list before saving.');
  if (status === 429) return l(lang,'Можно отправить до пяти обращений в час. Попробуй позже.','You can submit five tickets per hour. Try again later.');
  return l(lang,'Не удалось получить данные. Попробуй ещё раз.','Could not load the data. Try again.');
}

function useQuery<T>(action:string, args:Record<string,unknown>, enabled = true, revision = false) {
  const actor = useCloud(state => state.user?.id);
  const [refresh,setRefresh] = useState(0);
  const [query,setQuery] = useState<Query<T> & {key:string}>();
  const input = JSON.stringify(args);
  const key = JSON.stringify([action,actor,input,refresh,revision]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    communityRequest<T>(action,JSON.parse(input)).then(
      data => { if (active) setQuery({data,pending:false,key}); },
      error => { if (active) setQuery({error,pending:false,key}); },
    );
    return () => { active = false; };
  },[action,enabled,input,key]);
  const current:Query<T> = enabled && query?.key === key ? query : {pending:enabled};
  return {...current,reload:() => setRefresh(value => value+1)};
}

function QueryStatus({lang,query}: {lang:Lang;query:Query<unknown> & {reload():void}}) {
  if (query.pending) return <p role="status" className="muted">{l(lang,'Загрузка…','Loading…')}</p>;
  if (!query.error) return null;
  return <div className="game-tools"><p role="alert">{errorText(lang,query.error)}</p><button className="secondary" onClick={query.reload}>{l(lang,'Повторить','Retry')}</button></div>;
}

function Pager({lang,page,count,setPage}: {lang:Lang;page:number;count:number;setPage(page:number):void}) {
  return <div className="game-tools">
    {page > 0 && <button className="secondary" onClick={() => setPage(page-1)}>{l(lang,'Назад','Previous')}</button>}
    {count > pageSize && <button className="secondary" onClick={() => setPage(page+1)}>{l(lang,'Дальше','Next')}</button>}
  </div>;
}

export function Leaderboard({lang,profile}: {lang:Lang;profile:Profile}) {
  const actor = useCloud(state => state.user?.id);
  const phase = useCloud(state => state.phase);
  const query = useQuery<Ranking>('leaderboard',{},true,phase === 'ready');
  return <><PageTop title={l(lang,'Рейтинг','Leaderboard')}>{l(lang,'100 лучших игроков по суммарному XP.','Top 100 players by total XP.')}</PageTop>
    <section className="card placement-banner">
      <span className="panel-icon amber"><Trophy size={23}/></span><div>
        <h3>{query.data?.myPlace ? l(lang,'Твоё место','Your position') + ' · ' + query.data.myPlace : l(lang,'Общий рейтинг','Overall leaderboard')}</h3>
        {actor && <p>{profile.privacy ? l(lang,'Твой результат виден под именем «Игрок».','Your score appears under the name “Player”.') : l(lang,'Твоё имя видно в топе.','Your name is visible in the leaderboard.')}</p>}
      </div><button type="button" className="secondary" onClick={query.reload}><RefreshCw size={16}/>{l(lang,'Обновить','Refresh')}</button>
    </section>
    <section className="card dashboard-card leaderboard">
      <QueryStatus lang={lang} query={query}/>
      {query.data?.entries.length === 0 && <p className="empty">{l(lang,'Как только игроки заработают XP, они появятся здесь.','Players will appear here as soon as they earn XP.')}</p>}
      {query.data?.entries.map(entry => <div key={entry.place} className={'leader-row ' + (entry.self ? 'leader-self' : '')}>
        <span className="leader-rank">{entry.place}</span><b>{entry.self ? l(lang,'Ты','You') : entry.name || l(lang,'Игрок','Player')}</b>
        <strong>{entry.xp.toLocaleString(lang)} XP</strong>
      </div>)}
    </section>
  </>;
}

function TicketDetails({ticket,lang}: {ticket:Ticket;lang:Lang}) {
  const category = categories[ticket.category];
  return <>
    <div className="community-row-heading"><h3>{local(category,lang)}</h3><span className={'ticket-status ' + ticket.status}>{statusText(lang,ticket.status)}</span></div>
    <p className="muted">{dateText(lang,ticket.updated_at)}</p><p className="community-message">{ticket.message}</p>
    {ticket.response && <blockquote><strong>{l(lang,'Ответ поддержки','Support response')}</strong><p className="community-message">{ticket.response}</p></blockquote>}
  </>;
}

export function SupportPage({lang}: {lang:Lang}) {
  const actor = useCloud(state => state.user?.id);
  const [category,setCategory] = useState<Category>('other');
  const [message,setMessage] = useState('');
  const [page,setPage] = useState(0);
  const [saving,setSaving] = useState(false);
  const [failure,setFailure] = useState<unknown>();
  const [sent,setSent] = useState(false);
  const draft = useRef<{id:string;category:Category;message:string}>(undefined);
  const query = useQuery<Ticket[]>('support',{offset:page * pageSize},Boolean(actor));
  async function submit(event:FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (saving || !text) return;
    if (draft.current?.message !== text || draft.current.category !== category) draft.current = {id:crypto.randomUUID(),category,message:text};
    setSaving(true);setFailure(undefined);setSent(false);
    try {
      await communityRequest('ticket_create',draft.current);
      draft.current = undefined;
      setMessage('');setSent(true);setPage(0);query.reload();
    } catch (error) { setFailure(error); } finally { setSaving(false); }
  }
  return <><PageTop title={l(lang,'Поддержка','Support')}/>
    {!actor ? <section className="card dashboard-card">
      <p>{l(lang,'Чтобы отправить обращение, открой IQUP в Telegram.','Open IQUP in Telegram to send a support request.')}</p>
      {telegramAppUrl && <a className="secondary" href={telegramAppUrl}>{l(lang,'Открыть в Telegram','Open in Telegram')}</a>}
    </section> : <div className="community-stack">
      <form className="card dashboard-card settings-form" onSubmit={submit}>
        <h2>{l(lang,'Новое обращение','New ticket')}</h2>
        <label>{l(lang,'Раздел','Category')}<select disabled={saving} value={category} onChange={event => setCategory(event.target.value as Category)}>
          {Object.entries(categories).map(([key,label]) => <option key={key} value={key}>{local(label,lang)}</option>)}
        </select></label>
        <label>{l(lang,'Сообщение','Message')}<textarea disabled={saving} required maxLength={1000} value={message} onChange={event => setMessage(event.target.value)}/></label>
        <div className="game-tools"><button disabled={saving || !message.trim()} className="primary"><Send size={16}/>{l(lang,'Отправить','Send')}</button></div>
        {sent && <p role="status">{l(lang,'Обращение отправлено. Ответ появится здесь.','Ticket sent. The reply will appear here.')}</p>}
        {failure !== undefined && <p role="alert">{errorText(lang,failure)}</p>}
      </form>
      <section className="card dashboard-card community-stack"><div className="community-row-heading"><h2>{l(lang,'Мои обращения','My tickets')}</h2>
        <button className="secondary" onClick={query.reload}><RefreshCw size={16}/>{l(lang,'Обновить','Refresh')}</button></div>
        <QueryStatus lang={lang} query={query}/>
        {query.data?.length === 0 && <p className="muted">{l(lang,'Обращений пока нет.','No tickets yet.')}</p>}
        {query.data?.slice(0,pageSize).map(ticket => <article className="community-item" key={ticket.id}><TicketDetails ticket={ticket} lang={lang}/></article>)}
        {query.data && <Pager lang={lang} page={page} count={query.data.length} setPage={setPage}/>}
      </section>
    </div>}
  </>;
}

export function useAdminAccess(enabled:boolean) {
  return useQuery<{admin:boolean}>('role',{},enabled);
}
export function ProfileTools({lang,id}: {lang:Lang;id:string}) {
  const access = useAdminAccess(true);
  const [copied,setCopied] = useState(false);
  return <section className="card dashboard-card settings-form">
    <h2>{l(lang,'Telegram ID','Telegram ID')}</h2>
    <div className="game-tools"><code>{id}</code><button className="secondary" onClick={() => void navigator.clipboard?.writeText(id).then(() => setCopied(true),() => {})}>{copied ? l(lang,'Скопировано','Copied') : l(lang,'Копировать','Copy')}</button></div>
    {access.data?.admin && <Link className="secondary" to="/admin"><Shield size={16}/>{l(lang,'Админ-панель','Admin panel')}</Link>}
  </section>;
}

function AdminTicketEditor({lang,ticket,busy,save}: {lang:Lang;ticket:AdminTicket;busy:boolean;save(status:Status,response:string):void}) {
  const [response,setResponse] = useState(ticket.response ?? '');
  return <article className="community-item settings-form">
    <p className="muted">{ticket.name || l(lang,'Игрок','Player')} · <code>{ticket.owner}</code></p>
    <TicketDetails lang={lang} ticket={ticket}/>
    <label>{l(lang,'Ответ игроку','Reply to player')}<textarea maxLength={2000} value={response} onChange={event => setResponse(event.target.value)}/></label>
    <div className="game-tools">
      <button className="primary" disabled={busy || !response.trim() || response.trim() === ticket.response} onClick={() => save(ticket.status,response)}>{l(lang,'Сохранить ответ','Save reply')}</button>
      <button className="secondary" disabled={busy} onClick={() => save(ticket.status === 'open' ? 'closed' : 'open','')}>{ticket.status === 'open' ? l(lang,'Закрыть','Close') : l(lang,'Открыть снова','Reopen')}</button>
    </div>
  </article>;
}

type AdminTab = 'overview'|'queue'|'players'|'audit';
const adminTabs = [['overview','Сводка','Overview'],['queue','Обращения','Tickets'],['players','Игроки','Players'],['audit','Журнал действий','Audit log']] as const;
const auditLabels:Record<string,readonly [string,string]> = {hide:['Скрыт в рейтинге','Hidden from leaderboard'],show:['Возвращён в рейтинг','Restored to leaderboard'],close:['Обращение закрыто или обновлено','Ticket closed or updated'],reopen:['Обращение открыто повторно','Ticket reopened'],reply:['Ответ сохранён','Reply saved']};

export function AdminPage({lang}: {lang:Lang}) {
  const actor = useCloud(state => state.user?.id);
  const access = useAdminAccess(Boolean(actor));
  return <><PageTop title={l(lang,'Админ-панель','Admin panel')}/>
    {actor && <QueryStatus lang={lang} query={access}/>}
    {access.data?.admin && actor ? <AdminConsole lang={lang}/> : ((!actor || access.data) && <p className="empty">{l(lang,'Раздел доступен администраторам IQUP в Telegram.','This page is available to IQUP admins in Telegram.')}</p>)}
  </>;
}

function AdminConsole({lang}: {lang:Lang}) {
  const [tab,setTab] = useState<AdminTab>('overview');
  const [page,setPage] = useState(0);
  const [status,setStatus] = useState<Status|'all'>('open');
  const [draft,setDraft] = useState('');
  const [search,setSearch] = useState('');
  const [busy,setBusy] = useState(false);
  const [failure,setFailure] = useState<unknown>();
  const query = useQuery<Overview|Player[]|AdminTicket[]|Audit[]>(tab,{
    offset:page * pageSize,
    status:tab === 'queue' && status !== 'all' ? status : undefined,
    search:tab === 'players' ? search : undefined,
  });
  async function mutate(action:string,args:Record<string,unknown>) {
    if (busy) return;
    setFailure(undefined);setBusy(true);
    try { await communityRequest(action,args);query.reload(); }
    catch (error) { setFailure(error); } finally { setBusy(false); }
  }
  const rows = Array.isArray(query.data) ? query.data : [];
  const overview = query.data && !Array.isArray(query.data) ? query.data : undefined;
  return <div className="community-stack">
    <div className="pills">{adminTabs.map(([key,ru,en]) => <button disabled={busy} key={key} aria-pressed={tab === key} onClick={() => {setTab(key);setPage(0);setFailure(undefined);}}>{l(lang,ru,en)}</button>)}</div>
    <section className="card dashboard-card community-stack">
      {tab === 'queue' && <label>{l(lang,'Статус','Status')} <select aria-label={l(lang,'Статус','Status')} value={status} onChange={event => {setStatus(event.target.value as Status|'all');setPage(0);}}>
        <option value="open">{l(lang,'Открытые','Open')}</option><option value="closed">{l(lang,'Закрытые','Closed')}</option><option value="all">{l(lang,'Все','All')}</option>
      </select></label>}
      {tab === 'players' && <form className="game-tools" onSubmit={event => {event.preventDefault();setSearch(draft.trim());setPage(0);}}>
        <input type="search" maxLength={128} aria-label={l(lang,'Имя или Telegram ID','Name or Telegram ID')} placeholder={l(lang,'Имя или Telegram ID','Name or Telegram ID')} value={draft} onChange={event => setDraft(event.target.value)}/>
        <button className="secondary">{l(lang,'Найти','Search')}</button>
      </form>}
      <div className="game-tools"><button className="secondary" disabled={busy} onClick={query.reload}><RefreshCw size={16}/>{l(lang,'Обновить','Refresh')}</button></div>
      <QueryStatus lang={lang} query={query}/>
      {failure !== undefined && <p role="alert">{errorText(lang,failure)}</p>}
      {tab === 'overview' && overview && <dl className="community-metrics">
        {([[overview.players,'Входили в приложение','Signed in'],[overview.withXp,'Игроков с XP','Players with XP'],
          [overview.recent,'Сохраняли прогресс за 7 дней','Saved progress in 7 days'],[overview.open,'Открытых обращений','Open tickets']] as const)
          .map(([value,ru,en]) => <div className="community-item" key={en}><dt>{l(lang,ru,en)}</dt><dd>{value.toLocaleString(lang)}</dd></div>)}
      </dl>}
      {tab !== 'overview' && query.data && rows.length === 0 && <p className="muted">{l(lang,'Записей пока нет.','No records yet.')}</p>}
      {tab === 'queue' && (rows as AdminTicket[]).slice(0,pageSize).map(ticket => <AdminTicketEditor key={ticket.owner+ticket.id+ticket.updated_at} lang={lang} ticket={ticket} busy={busy}
        save={(status,response) => void mutate('ticket_update',{owner:ticket.owner,id:ticket.id,status,response,version:ticket.updated_at})}/>)}
      {tab === 'players' && (rows as Player[]).slice(0,pageSize).map(player => <article key={player.id} className="community-item community-row-heading">
        <div><h3>{player.name || l(lang,'Игрок','Player')}</h3><p className="muted">{player.id} · {player.xp.toLocaleString(lang)} XP</p></div>
        <button className="secondary" disabled={busy} onClick={() => void mutate('moderate',{owner:player.id,hidden:!player.hidden})}>{player.hidden ? l(lang,'Вернуть в топ','Restore to top') : l(lang,'Скрыть из топа','Hide from top')}</button>
      </article>)}
      {tab === 'audit' && (rows as Audit[]).map(item => <article key={item.id} className="community-item">
        <h3>{l(lang,...(auditLabels[item.action] ?? [item.action,item.action]))}</h3><p className="muted">{dateText(lang,item.created_at)} · {item.actor} → {item.target}</p>
      </article>)}
      {(tab === 'queue' || tab === 'players') && query.data && <Pager lang={lang} page={page} count={rows.length} setPage={setPage}/>}
    </section>
  </div>;
}
