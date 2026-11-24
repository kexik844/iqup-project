import { lazy, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Bell, CalendarDays, Check, ChevronRight, Coins, Flag, Flame, Globe2, LockKeyhole, Medal, MessageCircle, Settings, Share2, ShoppingBag, Sparkles, Star, Trophy, UserPlus, Users, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { byId, chapters, cosmeticById, cosmetics, cosmeticTypes, games, local, skillIds, skills, type CosmeticType, type Lang, type Skill } from './catalog';
import { accuracy, badges, dateKey, levelInfo, offsetDate, quests, streak, useData, weekKey, type Profile } from './progress';
import { getSkillSummary, l, PageTop, Rail, SkillIcon } from './ui';
import { type Queue } from './session';
import { share, telegram } from './telegram';
import { type TelegramUser } from './telegram-cloud';
import { ProfileTools } from './community';

const CloudPanel = lazy(() => import('./cloud-panel').then(module => ({default:module.CloudPanel})));

type PageProps = { profile:Profile; lang:Lang };
const dateText = (timestamp:number,lang:Lang) => new Date(timestamp).toLocaleDateString(lang,{day:'numeric',month:'short'});

export function CareerPage({ profile,lang,start }: PageProps & { start:(queue:Queue)=>void }) {
  const {disabled} = useData();
  return <><PageTop title={l(lang,'Карьера','Career')}>{l(lang,'Проходи главы по порядку и возвращайся за идеальным результатом.','Complete chapters in order and replay them for a perfect score.')}</PageTop>
    <div className="career-path">{chapters.map((chapter,index) => {
      const points = profile.career[index] ?? 0;
      const locked = index > 0 && !profile.career[index-1];
      const blocked = chapter.games.some(id => disabled.includes(id));
      return <div key={index} className={`career-row ${locked ? 'locked' : ''}`}>
        <span className="career-node">{locked ? <LockKeyhole size={21}/> : points === 2 ? <Star size={26} fill="currentColor"/> : points ? <Check size={26}/> : <Flag size={24}/>}</span>
        <section className="card career-card"><div><p className="kicker">{l(lang,'ГЛАВА','CHAPTER')} {index + 1}</p><h2>{local(chapter.name,lang)}</h2><p>{chapter.games.map(id => local(byId[id].name,lang)).join(' · ')}</p></div>
        <button className={points ? 'secondary' : 'primary'} disabled={locked || blocked} onClick={() => start({kind:'career',games:chapter.games,chapter:index})}>
          {locked ? l(lang,'Закрыто','Locked') : blocked ? l(lang,'Приостановлено','Paused') : points === 2 ? l(lang,'Идеально','Perfect') : points ? l(lang,'Повторить','Replay') : l(lang,'Начать','Begin')}<ChevronRight size={17}/></button></section>
      </div>;
    })}</div>
  </>;
}

export function ProgressPage({ profile,lang }: PageProps) {
  const [params,setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'summary';
  const claim = useData(state => state.claim);
  const items = getSkillSummary(profile);
  const [period,setPeriod] = useState(7);
  const completed = streak(profile.completedDays);
  const all = profile.history.filter(item => item.total > 0);
  const today = dateKey();
  const dayFrom = period ? dateKey(offsetDate(1-period)) : '';
  const filtered = all.filter(result => result.day >= dayFrom && result.day <= today);
  const measured = filtered.flatMap(result => result.reaction === undefined ? [] : [result.reaction]).sort((a,b) => a-b);
  const median = measured.length ? Math.round((measured[Math.floor((measured.length-1)/2)] + measured[Math.floor(measured.length/2)]) / 2) : 0;
  const mean = measured.length ? Math.round(measured.reduce((sum,time) => sum+time,0)/measured.length) : 0;
  const radar = items.map(({skill,history}) => {
    const sample = history.filter(result => result.day >= dayFrom && result.day <= today);
    return { skill:local(skills[skill].names,lang),value:sample.length ? Math.round(sample.reduce((sum,result) => sum + accuracy(result) * (.55 + .045 * result.level),0) / sample.length) : 0 };
  });
  const values = (period ? Array.from({length:period},(_,index) => dateKey(offsetDate(index+1-period))) : [...new Set(filtered.map(result=>result.day).concat(today))].sort()).map(day => ({
    day:new Date(day+'T12:00:00').toLocaleDateString(lang,{day:'numeric',month:'short'}),
    xp:filtered.filter(item => item.day === day).reduce((sum,item) => sum+item.xp,0),
  }));
  const best = games.flatMap(game => {
    const history = filtered.filter(result => result.game === game.id);
    return history.length ? [{name:game.name,score:Math.max(...history.map(result => result.score))}] : [];
  }).sort((a,b) => b.score-a.score).slice(0,5);
  const tabs = [['summary','Сводка','Overview'],['quests','Квесты','Quests'],['achievements','Достижения','Achievements'],['history','История','History']];
  return <><PageTop title={l(lang,'Прогресс','Progress')}>{l(lang,'Результаты упражнений и твоя активность.','Your exercise results and activity.')}</PageTop>
    <div className="pills tab-bar">{tabs.map(([id,ru,en]) => <button key={id} aria-pressed={tab === id} onClick={() => setParams(id === 'summary' ? {} : {tab:id})}>{l(lang,ru,en)}</button>)}</div>
    {tab === 'quests' ? <div className="dashboard-columns">{[false,true].map(weekly => <section className="card dashboard-card" key={String(weekly)}>
      <div className="panel-heading"><span className="panel-icon violet"><CalendarDays size={20}/></span><div><h2>{weekly ? l(lang,'Квесты недели','Weekly quests') : l(lang,'Квесты дня','Daily quests')}</h2></div></div>
      {quests(profile).filter(item => item.weekly === weekly).map(item => <div className="quest-detail" key={item.id}><div className="quest-label"><div><h3>{local(item.name,lang)}</h3><small>+{item.xp} XP · +{item.coins} IQ Coins</small></div><b>{Math.min(item.progress,item.target)}/{item.target}</b></div>
        <Rail value={item.progress} max={item.target}/><button className="secondary" disabled={item.progress < item.target || profile.claimed.includes(item.id)} onClick={() => claim(item.id)}>
          {profile.claimed.includes(item.id) ? l(lang,'Награда получена','Reward collected') : l(lang,'Забрать награду','Claim reward')}</button></div>)}</section>)}</div>
    : tab === 'achievements' ? <div className="catalog-grid">{badges.map(badge => {
      const unlocked = profile.achievements[badge.id];
      const progress = badge.evaluate(profile);
      const rarity = [['Обычное','Common'],['Редкое','Rare'],['Эпическое','Epic'],['Легендарное','Legendary']] as const;
      return <section className="card exercise-card badge-card" key={badge.id}><span className={`panel-icon ${unlocked ? 'amber' : 'violet'}`}>{unlocked ? <Medal size={23}/> : <LockKeyhole size={21}/>}</span>
        <div><small>{local(rarity[badge.rarity],lang)} · {badge.coins} IQ Coins</small><h3>{local(badge.title,lang)}</h3><p>{unlocked ? unlocked : `${Math.min(progress,badge.target)} / ${badge.target}`}</p></div><Rail value={unlocked ? badge.target : progress} max={badge.target}/></section>;
    })}</div>
    : tab === 'history' ? <section className="card dashboard-card"><div className="panel-heading"><span className="panel-icon mint"><BarChart3 size={20}/></span><div><h2>{l(lang,'История тренировок','Workout history')}</h2></div></div>
      {profile.history.length ? profile.history.map(result => <div className="history-row" key={result.id}><SkillIcon id={byId[result.game].skill} size={18}/><div><b>{local(byId[result.game].name,lang)}</b><small>{dateText(result.at || new Date(result.day+'T12:00').getTime(),lang)} · {l(lang,'Уровень','Level')} {result.stage ?? result.level}{result.demo && l(lang,' · демо',' · sample')}</small></div>
        <span>{result.total ? accuracy(result)+'%' : '–'}</span><strong>+{result.xp} XP</strong></div>) : <p className="empty">{l(lang,'История появится после первой тренировки.','Your history appears after your first workout.')}</p>}</section>
    : <>
      <div className="stat-grid">
        {[[Zap,'XP',profile.xp],[Flame,l(lang,'Серия дней','Day streak'),completed.current],[Trophy,l(lang,'Рекорд серии','Best streak'),completed.best],[Flag,l(lang,'Тренировки','Workouts'),all.length],
          [CalendarDays,l(lang,'Время занятий','Time trained'),Math.round(all.reduce((sum,item)=>sum+item.duration,0)/60) + l(lang,' мин',' min')],
          [BarChart3,l(lang,'Средняя точность','Mean accuracy'),all.length ? Math.round(all.reduce((sum,item)=>sum+accuracy(item),0)/all.length)+'%' : '—'],
          [Zap,l(lang,'Реакция: среднее','Mean reaction'),mean ? mean+' ms' : '—'],[Zap,l(lang,'Реакция: медиана','Median reaction'),median ? median+' ms' : '—']].map(([Icon,label,value]) => {
          const StatIcon = Icon as typeof Zap;
          return <section className="card stat-box" key={String(label)}><StatIcon size={21}/><strong>{String(value)}</strong><span>{String(label)}</span></section>;
        })}
      </div>
      <div className="dashboard-columns progress-columns">
        <section className="card dashboard-card"><div className="panel-heading"><div><h2>{l(lang,'Динамика XP','XP over time')}</h2><p>{l(lang,'Очки за упражнения','Exercise points')}</p></div>
          <select className="push" aria-label={l(lang,'Период','Period')} value={period} onChange={event => setPeriod(Number(event.target.value))}><option value={7}>{l(lang,'7 дней','7 days')}</option><option value={30}>{l(lang,'30 дней','30 days')}</option><option value={90}>{l(lang,'90 дней','90 days')}</option><option value={0}>{l(lang,'Всё время','All time')}</option></select></div>
          <div className="chart"><ResponsiveContainer width="100%" height={232}><AreaChart data={values} margin={{left:-23,right:10,top:12,bottom:0}}>
            <defs><linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9e88ff" stopOpacity={.38}/><stop offset="98%" stopColor="#9e88ff" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#29314e" strokeDasharray="4 4"/><XAxis dataKey="day" tick={{fill:'#a0aac7',fontSize:10}} tickLine={false} axisLine={false} minTickGap={18}/><YAxis allowDecimals={false} tick={{fill:'#a0aac7',fontSize:11}} tickLine={false} axisLine={false}/>
            <Tooltip contentStyle={{background:'#1c2540',border:'1px solid #40517a',borderRadius:12}}/><Area type="monotone" dataKey="xp" name="XP" stroke="#a897ff" strokeWidth={2.5} fill="url(#xpFill)" isAnimationActive={false}/>
          </AreaChart></ResponsiveContainer></div>
        </section>
        <section className="card dashboard-card"><div className="panel-heading"><span className="panel-icon mint"><BarChart3 size={21}/></span><div><h2>{l(lang,'Когнитивный профиль','Skill profile')}</h2><p>{l(lang,'Точность в упражнениях','Exercise accuracy')}</p></div></div>
          {filtered.length < 3 ? <p className="empty">{l(lang,'Недостаточно тренировок','Not enough workouts')}</p> : <div className="chart"><ResponsiveContainer width="100%" height={235}>
            <RadarChart data={radar} outerRadius="66%"><PolarGrid stroke="#445073"/><PolarAngleAxis dataKey="skill" tick={{fill:'#a0aac7',fontSize:11}}/>
              <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false}/><Radar dataKey="value" stroke="#b69dff" fill="#9478ef" fillOpacity={.45} isAnimationActive={false}/><Tooltip contentStyle={{background:'#1c2540',border:'1px solid #40517a',borderRadius:12}}/></RadarChart>
          </ResponsiveContainer></div>}
        </section>
      </div>
      <section className="card dashboard-card calendar-card"><div className="panel-heading"><span className="panel-icon violet"><Medal size={21}/></span><div><h2>{l(lang,'Личные рекорды','Personal bests')}</h2></div></div>
        {best.length ? best.map(item => <div className="history-row" key={item.name[0]}><div>{local(item.name,lang)}</div><strong>{item.score} / 100</strong></div>) : <p className="muted">{l(lang,'Недостаточно тренировок','Not enough workouts')}</p>}</section>
      <section className="card dashboard-card calendar-card"><div className="panel-heading"><span className="panel-icon amber"><Flame size={21}/></span><div><h2>{l(lang,'Календарь активности','Activity calendar')}</h2><p>{l(lang,'28 последних дней','Past 28 days')}</p></div></div>
        <div className="activity-grid">{Array.from({length:28},(_,index) => {
          const date = offsetDate(index - 27);
          const done = profile.completedDays.includes(dateKey(date));
          return <span key={index} className={`calendar-day ${done ? 'complete' : ''} ${index === 27 ? 'today' : ''}`} title={date.toLocaleDateString(lang)}>{done ? <Flame size={14}/> : date.getDate()}</span>;
        })}</div>
      </section>
    </>}
  </>;
}

const rankNames = [['Новичок','Rookie'],['Исследователь','Explorer'],['Мыслитель','Thinker'],['Стратег','Strategist'],['Эксперт','Expert'],['Мастер','Master'],['Легенда IQUP','IQUP Legend']] as const;
function rank(xp:number,lang:Lang) { return local(rankNames[Math.min(rankNames.length - 1,Math.floor((levelInfo(xp).level - 1) / 4))],lang); }
export function Shop({profile,lang}:PageProps) {
  const [message,setMessage] = useState('');
  const [tab,setTab] = useState<'shop'|'inventory'|'ledger'>('shop');
  const [type,setType] = useState<CosmeticType|'all'>('all');
  const [preview,setPreview] = useState<string>();
  const selected = preview ? cosmeticById[preview] : undefined;
  const rarities = [['Обычный','Common'],['Редкий','Rare'],['Эпический','Epic'],['Легендарный','Legendary']] as const;
  const buy = useData(state => state.buy);
  const labels: Record<string,readonly [string,string]> = { initialDemo:['Баланс демо-профиля','Sample profile balance'],level:['Новый уровень','New level'],
    daily:['Тренировка дня','Daily workout'],quest:['Квест','Quest'],career:['Глава карьеры','Career chapter'],achievement:['Достижение','Achievement'],purchase:['Покупка оформления','Theme purchase'] };
  return <><PageTop title={l(lang,'Магазин','Shop')}>{l(lang,'Аватары, оформление и скины за внутриигровые IQ Coins.','Avatars, themes and skins for in-app IQ Coins.')}</PageTop>
    <div className="filters"><div className="pills">{([['shop','Магазин','Shop'],['inventory','Инвентарь','Inventory'],['ledger','История монет','Coin history']] as const).map(([id,ru,en]) =>
      <button key={id} aria-pressed={tab === id} onClick={() => {setTab(id);setMessage('');}}>{l(lang,ru,en)}</button>)}</div><span className="resource-pill coin-pill"><Coins size={19}/><b>{profile.coins} IQ Coins</b></span></div>
    {tab !== 'ledger' && <div className="pills tab-bar"><button aria-pressed={type === 'all'} onClick={() => setType('all')}>{l(lang,'Все','All')}</button>
      {(Object.keys(cosmeticTypes) as CosmeticType[]).map(id => <button key={id} aria-pressed={type === id} onClick={() => setType(id)}>{local(cosmeticTypes[id],lang)}</button>)}</div>}
    {message && <p role="status" className="notice">{message}</p>}
    {tab === 'ledger' ? <div className="card dashboard-card">{profile.ledger.length ? profile.ledger.map(item => <div className="history-row" key={item.id}>
      <span className="panel-icon amber"><Coins size={18}/></span><div><b>{local(labels[item.label] ?? byId[item.label]?.name ?? [item.label,item.label],lang)}</b><small>{item.date}</small></div><strong>{item.coins > 0 ? '+' : ''}{item.coins} IQ Coins</strong></div>)
      : <p className="empty">{l(lang,'Пока нет операций.','No transactions yet.')}</p>}</div>
    : <div className="catalog-grid">{cosmetics.filter(item => (type === 'all' || item.type === type) && (tab === 'shop' || profile.owned.includes(item.id))).map(item => {
      const active = item.type === 'theme' ? profile.theme === item.id : profile.equipped[item.type] === item.id;
      const owned = profile.owned.includes(item.id);
      return <section className="card shop-card" key={item.id}><button className="theme-swatch" aria-label={l(lang,'Предпросмотр','Preview')+' · '+local(item.name,lang)}
        style={{background:item.colors[0],color:item.colors[1]}} onClick={() => setPreview(item.id)}><b>{item.symbol}</b></button>
        <div><h3>{local(item.name,lang)}</h3><p>{local(rarities[item.rarity],lang)} · {owned ? l(lang,'В инвентаре','In inventory') : `${item.cost} IQ Coins`}</p></div>
        <button className="secondary" disabled={active} onClick={() => owned ? buy(item.id) : setPreview(item.id)}>
          {active ? <Check size={17}/> : owned ? <Sparkles size={17}/> : <ShoppingBag size={17}/>} {active ? l(lang,'Выбрано','Selected') : owned ? l(lang,'Применить','Apply') : l(lang,'Купить','Buy')}</button></section>;
    })}</div>}
    {selected && <div className="modal-overlay" onClick={() => setPreview(undefined)}><section className="card modal" role="dialog" aria-modal="true" aria-label={local(selected.name,lang)} onClick={event => event.stopPropagation()}>
      <div className="theme-swatch" style={{background:selected.colors[0],color:selected.colors[1]}}><b>{selected.symbol}</b></div>
      <h2>{local(selected.name,lang)}</h2><p>{local(rarities[selected.rarity],lang)} · {profile.owned.includes(selected.id) ? l(lang,'В инвентаре','In inventory') : `${selected.cost} IQ Coins`}</p>
      <div className="game-tools"><button className="secondary" onClick={() => setPreview(undefined)}>{l(lang,'Закрыть','Close')}</button>
        <button className="primary" onClick={() => {setMessage(buy(selected.id) ? l(lang,'Предмет применён','Item applied') : l(lang,'Не хватает IQ Coins','Not enough IQ Coins'));setPreview(undefined);}}>
          {profile.owned.includes(selected.id) ? l(lang,'Применить','Apply') : l(lang,'Подтвердить покупку','Confirm purchase')}</button></div>
    </section></div>}

  </>;
}

function Report({profile,lang}:PageProps) {
  const start = weekKey();
  const week = profile.history.filter(item => item.day >= start);
  const results = getSkillSummary({...profile,history:week}).filter(item => item.history.length).sort((a,b) => b.percent-a.percent);
  return <div className="report-preview"><b>{l(lang,'Твоя неделя в IQUP','Your week in IQUP')}</b><p>{l(lang,'Тренировки','Workouts')} · {week.length}<br/>
    XP · {week.reduce((sum,item) => sum+item.xp,0)}<br/>{l(lang,'Время','Time')} · {Math.round(week.reduce((sum,item) => sum+item.duration,0)/60)} {l(lang,'мин','min')}<br/>
    {l(lang,'Новые достижения','New achievements')} · {Object.values(profile.achievements).filter(day => day >= start).length}<br/>
    {l(lang,'Лучшее направление','Best skill')} · {results.length ? local(skills[results[0].skill].names,lang) : '—'}</p></div>;
}

export function GuestProfilePage({lang}: {lang:Lang}) {
  return <>
    <PageTop title={l(lang,'Гостевой режим','Guest mode')}>
      {l(lang,'Ты можешь тренироваться. Прогресс сохраняется на этом устройстве.','You can train as a guest. Your progress stays on this device.')}
    </PageTop>
    <CloudPanel lang={lang}/>
  </>;
}

export function ProfilePage({profile,lang,demo,settings=false,identity,onSetup}:PageProps & {demo:boolean;settings?:boolean;identity?:TelegramUser;onSetup?:()=>void}) {
  const state = useData();
  const [message,setMessage] = useState('');
  const [reset,setReset] = useState(false);
  const [failedPhoto,setFailedPhoto] = useState<string>();
  const name = identity?.name || l(lang,'Твой профиль','Your profile');
  const avatar = cosmeticById[profile.equipped.avatar ?? ''];
  const frame = cosmeticById[profile.equipped.frame ?? ''];
  const background = cosmeticById[profile.equipped.background ?? ''];
  const emblem = cosmeticById[profile.equipped.badge ?? ''];
  function updateGoals(goal:Skill) {
    const goals = profile.goals.includes(goal) ? profile.goals.filter(skill => skill !== goal) : [...profile.goals,goal];
    if (goals.length) state.profile({goals});
  }
  async function shareAction(referral:boolean) {
    const text = referral ? l(lang,'Тренируй мышление вместе со мной в IQUP.','Train your brain with me in IQUP.') : `IQUP · ${rank(profile.xp,lang)} · ${profile.xp} XP`;
    setMessage(await share(text,referral) ? l(lang,'Ссылка готова к отправке','Link ready to share') : l(lang,'Не удалось отправить ссылку','The link could not be shared'));
  }
  return <><PageTop title={settings ? l(lang,'Настройки','Settings') : l(lang,'Профиль','Profile')}>{settings ? l(lang,'Язык и ежедневный план.','Language and your daily plan.') : l(lang,'Твой прогресс и настройки IQUP.','Your IQUP progress and preferences.')}</PageTop>
    {!settings && <section className="card placement-banner profile-banner" style={{background:background?.colors[0]}}>
      <span className="avatar big-avatar" style={{background:avatar?.colors[0],outline:frame ? `3px solid ${frame.colors[1]}` : undefined}}>
        {identity?.photo && identity.photo !== failedPhoto
          ? <img src={identity.photo} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(identity.photo)}/>
          : avatar?.symbol || Array.from(name)[0]}
      </span><div><h3>{name} {emblem?.symbol}</h3>{identity?.username && <p>@{identity.username}</p>}<p>{rank(profile.xp,lang)} · {l(lang,'Уровень','Level')} {levelInfo(profile.xp).level}</p></div>
      <Link to="/settings" className="secondary"><Settings size={17}/>{l(lang,'Настройки','Settings')}</Link></section>}
    <div className="dashboard-columns">
      <section className="card dashboard-card settings-form">
        <div className="panel-heading"><span className="panel-icon violet"><Settings size={21}/></span><div><h2>{l(lang,'Персонализация','Personalization')}</h2></div></div>
        {demo && <label>{l(lang,'Имя в демо','Demo name')}<input value={profile.name} maxLength={32} onChange={event => state.profile({name:event.target.value})}/></label>}
        <label>{l(lang,'Возрастная группа','Age group')}<select value={profile.age} onChange={event => state.profile({age:event.target.value})}>
          <option value="">{l(lang,'Не указано','Unspecified')}</option><option value="under14">{l(lang,'До 14','Under 14')}</option><option value="14-17">14–17</option><option value="18-59">18–59</option><option value="60+">60+</option></select></label>
        <label>{l(lang,'Длительность плана','Workout duration')}<select value={profile.minutes} onChange={event => state.profile({minutes:Number(event.target.value)})}>{[5,10,15,20].map(num => <option key={num} value={num}>{num} {l(lang,'мин','min')}</option>)}</select></label>
        <div className="pills">{skillIds.map(skill => <button key={skill} aria-pressed={profile.goals.includes(skill)} onClick={() => updateGoals(skill)}>{local(skills[skill].names,lang)}</button>)}</div>
        <div className="game-tools settings-actions"><button className="secondary" onClick={() => state.profile({age:'',minutes:5,goals:[...skillIds]})}>{l(lang,'Сбросить параметры','Reset preferences')}</button>
          {onSetup && <button className="text-link" onClick={onSetup}>{l(lang,'Знакомство с IQUP','IQUP introduction')}<ChevronRight size={16}/></button>}</div>
      </section>
      <section className="card dashboard-card settings-form">
        <div className="panel-heading"><span className="panel-icon mint"><Globe2 size={21}/></span><div><h2>{l(lang,'Приложение','App preferences')}</h2></div></div>
        <label>{l(lang,'Язык','Language')}<select value={lang} onChange={event => state.configure({lang:event.target.value as Lang})}><option value="ru">Русский</option><option value="en">English</option></select></label>
        {!identity && <label>{l(lang,'Режим тренировки','Workout mode')}<select value={state.mode} onChange={event => state.configure({mode:event.target.value as 'demo'|'personal',onboarding:true})}><option value="demo">{l(lang,'Демо-режим','Demo mode')}</option><option value="personal">{l(lang,'Гостевой режим','Guest mode')}</option></select></label>}
        <label className="check-line"><input type="checkbox" checked={state.reduced} onChange={event => state.configure({reduced:event.target.checked})}/>{l(lang,'Уменьшить анимации','Reduce motion')}</label>
        <label className="check-line"><input type="checkbox" checked={state.sound} onChange={event => state.configure({sound:event.target.checked})}/>{l(lang,'Звуки игры','Game sounds')}</label>
        <label className="check-line"><input type="checkbox" checked={state.haptics} onChange={event => state.configure({haptics:event.target.checked})}/>{l(lang,'Вибрация в Telegram','Haptics in Telegram')}</label>
        {identity && <label className="check-line"><input type="checkbox" checked={!profile.privacy} onChange={event => state.profile({privacy:!event.target.checked})}/>{l(lang,'Показывать имя в рейтинге','Show name in leaderboard')}</label>}
        <label className="check-line"><input type="checkbox" checked={profile.reports} onChange={event => state.profile({reports:event.target.checked})}/>{l(lang,'Согласие на еженедельный отчёт','Opt in to the weekly report')}</label>
        <small>{l(lang,'Отчёт доступен для предпросмотра. Рассылка не подключена.','A sample report is available. Delivery is offline.')}</small>
        <details><summary>{l(lang,'Конфиденциальность','Privacy')}</summary><p className="muted">{l(lang,'В браузере гостевой прогресс хранится на этом устройстве. В Telegram результаты сохраняются в твоём аккаунте. Карточка результата передаётся только по твоему действию.','Guest progress stays in this browser. In Telegram, results are saved to your account. Result cards are shared when you choose.')}</p></details>
        {settings && <button className="secondary" onClick={() => setReset(true)}>{l(lang,'Сбросить прогресс','Reset progress')}</button>}
        {telegram()?.initData && <button className="secondary" onClick={() => telegram()?.close()}>{l(lang,'Закрыть Mini App','Close Mini App')}</button>}
      </section>
    </div>
    {settings && <><CloudPanel lang={lang}/>{identity && <ProfileTools lang={lang} id={identity.id}/>}</>}
    {reset && <div className="modal-overlay"><section className="card modal" role="dialog" aria-modal="true" aria-label={l(lang,'Сброс прогресса','Reset progress')}>
      <h2>{l(lang,'Сбросить прогресс?','Reset progress?')}</h2><p>{identity
        ? l(lang,'Результаты, покупки и настройки будут удалены из твоего аккаунта IQUP.','This removes results, purchases and preferences from your IQUP account.')
        : l(lang,'Результаты, покупки и настройки текущего режима будут удалены на этом устройстве.','This removes results, purchases and preferences for the current mode on this device.')}</p>
      <div className="game-tools"><button className="secondary" onClick={() => setReset(false)}>{l(lang,'Отмена','Cancel')}</button>
        <button className="primary" onClick={() => {state.resetProfile();setReset(false);}}>{l(lang,'Сбросить','Reset')}</button></div></section></div>}
    {!settings && <div className="dashboard-columns extra-cards">
      <section className="card dashboard-card"><div className="panel-heading"><span className="panel-icon violet"><Users size={21}/></span><div><h2>{l(lang,'Поделиться IQUP','Share IQUP')}</h2></div></div>
        <div className="game-tools settings-actions"><button className="secondary" onClick={() => void shareAction(true)}><UserPlus size={17}/>{l(lang,'Пригласить','Invite')}</button><button className="secondary" onClick={() => void shareAction(false)}><Share2 size={17}/>{l(lang,'Поделиться','Share')}</button></div>
        {message && <p role="status" className="muted">{message}</p>}</section>
      <section className="card dashboard-card"><div className="panel-heading"><span className="panel-icon mint"><Bell size={21}/></span><div><h2>{l(lang,'Еженедельный отчёт','Weekly report')}</h2><p>{l(lang,'Предпросмотр сообщения','Message preview')}</p></div></div><Report profile={profile} lang={lang}/></section>
      <section className="card dashboard-card"><div className="panel-heading"><span className="panel-icon violet"><MessageCircle size={20}/></span><div><h2>{l(lang,'Поддержка','Support')}</h2></div></div>
        <Link to="/support" className="secondary">{l(lang,'Мои обращения','My tickets')}<ChevronRight size={16}/></Link>
        {profile.tickets.length > 0 && <details><summary>{l(lang,'Старые локальные черновики','Old local drafts')}</summary>
          {profile.tickets.map(ticket => <p className="community-message" key={ticket.id}>{ticket.text}</p>)}</details>}
      </section>
    </div>}
  </>;
}
