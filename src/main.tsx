import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, BookOpen, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coins, Flag, Flame, Gamepad2, Home, MessageCircle, Play, Settings, ShoppingBag, Star, Target, Trophy, UserRound, X, Zap } from 'lucide-react';
import './i18n';
import { byId, cosmeticById, games, local, skillIds, skills, themes, type Lang, type Skill } from './catalog';
import { activeProfile, dateKey, levelInfo, makePlan, offsetDate, quests, streak, useData, type Profile } from './progress';

import { l, PageTop, Rail, SkillIcon } from './ui';
import { Session, type Queue } from './session';
import { initTelegram, telegram } from './telegram';
import './styles.css';
import { startCloud, syncCloud, useCloud } from './cloud';
import { type TelegramUser } from './telegram-cloud';
import { CloudPanel } from './cloud-panel';

const CareerPage = lazy(() => import('./pages').then(module => ({ default:module.CareerPage })));
const Leaderboard = lazy(() => import('./community').then(module => ({default:module.Leaderboard})));
const SupportPage = lazy(() => import('./community').then(module => ({default:module.SupportPage})));
const AdminPage = lazy(() => import('./community').then(module => ({default:module.AdminPage})));
const ProfilePage = lazy(() => import('./pages').then(module => ({ default:module.ProfilePage })));
const GuestProfilePage = lazy(() => import('./pages').then(module => ({ default:module.GuestProfilePage })));
const ProgressPage = lazy(() => import('./pages').then(module => ({ default:module.ProgressPage })));
const Shop = lazy(() => import('./pages').then(module => ({ default:module.Shop })));

const mainLinks = [
  ['home',Home],['games',Gamepad2],['career',Flag],['progress',BarChart3],['rating',Trophy],['shop',ShoppingBag],['profile',UserRound],
] as const;

function Avatar({ identity, profile }: { identity:TelegramUser; profile:Profile }) {
  const avatar = cosmeticById[profile.equipped.avatar ?? ''];
  const frame = cosmeticById[profile.equipped.frame ?? ''];
  const [failedPhoto,setFailedPhoto] = useState<string>();
  const style = { background:avatar?.colors[0], outline:frame ? `2px solid ${frame.colors[1]}` : undefined };
  return <span aria-hidden="true" className="avatar" style={style}>{identity.photo && identity.photo !== failedPhoto
    ? <img src={identity.photo} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(identity.photo)}/>
    : avatar?.symbol || Array.from(identity.name)[0] || <UserRound size={19}/>}</span>;
}
function Logo() {
  return <NavLink to="/home" className="logo" aria-label="IQUP"><span className="logo-symbol"><Brain size={21} strokeWidth={1.85}/></span><span>IQ<span>UP</span></span></NavLink>;
}
function Sidebar({ profile,lang,signedIn }: { profile:Profile; lang:Lang; signedIn:boolean }) {
  const {t} = useTranslation();
  const level = levelInfo(profile.xp);
  return <aside className="sidebar"><Logo/>
    <nav aria-label={l(lang,'Разделы','Sections')}>
      {mainLinks.map(([id,Icon]) => <NavLink className="side-link" key={id} to={'/'+id}><Icon size={20}/><span>{id === 'profile' && !signedIn ? l(lang,'Гость','Guest') : t(id)}</span></NavLink>)}
    </nav>
    <div className="side-bottom">
      <NavLink className="side-link" to="/support"><MessageCircle size={20}/><span>{l(lang,'Поддержка','Support')}</span></NavLink>
      <NavLink className="side-link" to="/settings"><Settings size={20}/><span>{t('settings')}</span></NavLink>
      <div className="side-level"><div className="side-level-top"><div className="level-bolt"><Zap size={18}/></div><div><strong>{l(lang,'Уровень','Level')} {level.level}</strong><small>{level.spent} / {level.needed} XP</small></div></div><Rail value={level.spent} max={level.needed}/></div>
    </div>
  </aside>;
}
function Header({ profile,lang,demo,identity }: { profile:Profile; lang:Lang; demo:boolean; identity?:TelegramUser }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const page = loc.pathname.split('/')[1];
  const title = page === 'support' ? l(lang,'Поддержка','Support') : page === 'admin' ? l(lang,'Админ-панель','Admin panel') : t(page === 'play' ? 'games' : page || 'home');
  return <header className="topbar">
    <div className="desktop-crumb">{page === 'profile' && !identity ? l(lang,'Гость','Guest') : title}</div>
    <div className="mobile-logo"><Logo/></div>
    <div className="top-resources">
      {demo && <NavLink className="demo-pill" to="/settings" aria-label={t('demo')}>
        <span className="demo-label">{t('demo')}</span><span className="demo-label-short" aria-hidden="true">{l(lang,'Демо','Demo')}</span>
      </NavLink>}
      <NavLink className="resource-pill streak-pill" to="/progress" aria-label={l(lang,'Дней подряд','Day streak')} title={l(lang,'Дней подряд','Day streak')}><Flame size={19}/><b>{streak(profile.completedDays).current}</b></NavLink>
      <NavLink className="resource-pill coin-pill" to="/shop" aria-label="IQ Coins"><Coins size={19}/><b>{profile.coins.toLocaleString(lang)}</b></NavLink>
      {identity
        ? <NavLink className="user-link" to="/profile" aria-label={t('profile')}><Avatar identity={identity} profile={profile}/><ChevronDown size={14}/></NavLink>
        : <NavLink className="guest-link" to="/profile">{l(lang,'Гость','Guest')}</NavLink>}
    </div>
  </header>;
}
function MobileNav({ lang,signedIn }: { lang:Lang; signedIn:boolean }) {
  const {t} = useTranslation();
  return <nav className="mobile-nav" aria-label="IQUP">
    {mainLinks.filter(([id]) => !['career','shop'].includes(id)).map(([id,Icon]) => <NavLink key={id} to={'/'+id}><Icon size={21}/><span>{id === 'profile' && !signedIn ? l(lang,'Гость','Guest') : t(id)}</span></NavLink>)}
  </nav>;
}
function Dashboard({ profile,lang,demo,identity,start }: { profile:Profile; lang:Lang; demo:boolean; identity?:TelegramUser; start:(queue:Queue) => void }) {
  const state = useData();
  const plan = makePlan(profile,state.disabled);
  const cycled = plan.games.filter(id => profile.history.some(item => item.day === plan.day && item.game === id && !item.demo));
  const next = plan.games.filter(id => !cycled.includes(id));
  const today = quests(profile).filter(quest => !quest.weekly);
  const completed = plan.completed ? plan.games.length : cycled.length;
  const currentStreak = streak(profile.completedDays);
  const begin = () => {
    const stored = state.startPlan();
    if (!next.length && !stored.completed && stored.games.length) state.completeDaily();
    if (next.length) start({ kind:'daily', games:next });
  };
  const title = demo ? l(lang,'Демо-режим','Demo mode') : identity?.name ? l(lang,'Привет, ','Hey, ') + identity.name + '!' : l(lang,'Тренировки IQUP','IQUP training');
  const mascot = cosmeticById[profile.equipped.mascot ?? ''];
  const effect = cosmeticById[profile.equipped.effect ?? ''];
  const weekday = new Date().toLocaleDateString(lang,{weekday:'long',day:'numeric',month:'long'});
  return <>
    <div className="greeting">
      <div><p className="dashboard-date">{weekday}</p><h1>{title}</h1></div>
      <NavLink to="/career" className="secondary career-link"><Flag size={16}/>{l(lang,'Мой путь','My journey')}</NavLink>
    </div>
    <section className="card daily-card" aria-labelledby="daily-heading">
      <div className="daily-main">
        <div className="daily-symbol" aria-hidden="true" style={{color:mascot?.colors[1]}}>
          <Brain size={22} strokeWidth={1.85}/>{effect && <span style={{color:effect.colors[1]}}>{effect.symbol}</span>}
        </div>
        <h2 id="daily-heading">{l(lang,'Тренировка дня','Daily workout')}</h2>
        <div className="daily-meta"><span><Clock3 size={16}/>{profile.minutes} {l(lang,'мин','min')}</span><span><Zap size={16}/>+{state.dailyBonus} XP</span></div>
        <button className="primary daily-button" onClick={begin} disabled={plan.completed || !plan.games.length}>
          {plan.completed ? <Check size={17}/> : <Play size={16}/>}
          {plan.completed ? l(lang,'Тренировка пройдена','Workout complete') : completed === plan.games.length && completed > 0 ? l(lang,'Завершить тренировку','Finish workout') : completed ? l(lang,'Продолжить тренировку','Continue workout') : l(lang,'Начать тренировку','Start workout')}
        </button>
      </div>
      {plan.games.length > 0 && <div className="daily-plan">
        <div className="daily-plan-heading"><h3>{l(lang,'План на сегодня','Today’s plan')}</h3><span>{completed}/{plan.games.length}</span></div>
        <Rail value={completed} max={plan.games.length}/>
        <ul className="daily-exercises">
          {plan.games.map(id => {
            const done = plan.completed || cycled.includes(id);
            return <li key={id}>
              <span className={`plan-status ${done ? 'is-complete' : ''}`} aria-label={done ? l(lang,'Выполнено','Complete') : l(lang,'В плане','Planned')}>
                {done && <Check size={12} aria-hidden="true"/>}
              </span>
              {local(byId[id].name,lang)}
            </li>;
          })}
        </ul>
      </div>}
    </section>

    <section className="directions">
      <div className="section-heading"><h2>{l(lang,'Направления','Skills')}</h2><NavLink className="text-link" to="/games">{l(lang,'Все тренировки','All training')}<ArrowRight size={16}/></NavLink></div>
      <div className="skill-list">{skillIds.map(id => <NavLink key={id} to={'/games?skill='+id} className="card skill-card"><SkillIcon id={id}/><div><h3>{local(skills[id].names,lang)}</h3><p>{l(lang,'5 упражнений','5 exercises')}</p></div><ChevronRight size={15} className="skill-arrow"/></NavLink>)}</div>
    </section>

    <div className="dashboard-columns">
      <section className="card dashboard-card">
        <div className="panel-heading"><h2>{l(lang,'Задания дня','Daily quests')}</h2><NavLink to="/progress?tab=quests" className="text-link compact-link">{l(lang,'Все задания','All quests')}<ChevronRight size={16}/></NavLink></div>
        {today.map(quest => <div key={quest.id} className="quick-quest"><div><b>{local(quest.name,lang)}</b><span>{Math.min(quest.progress,quest.target)}/{quest.target}</span></div><Rail value={quest.progress} max={quest.target}/></div>)}
      </section>
      <section className="card dashboard-card streak-card">
        <div className="panel-heading"><h2>{l(lang,'Серия дней','Day streak')}</h2></div>
        <div className="streak-current"><Flame size={20} aria-hidden="true"/><strong>{currentStreak.current}</strong><span>{l(lang,currentStreak.current === 1 ? 'день подряд' : currentStreak.current >= 2 && currentStreak.current <= 4 ? 'дня подряд' :'дней подряд','days in a row')}</span></div>
        <div className="week-grid">{Array.from({length:7},(_,i) => {
          const date = offsetDate(i - 6);
          const today = i === 6;
          const done = profile.completedDays.includes(dateKey(date));
          return <div key={i}><span>{date.toLocaleDateString(lang,{weekday:'short'})}</span><span className={`calendar-day ${done ? 'complete' : ''} ${today ? 'today' : ''}`}>{done ? <Flame size={16}/> : date.getDate()}</span></div>;
        })}</div>
        <NavLink to="/progress" className="text-link streak-link">{l(lang,'Календарь активности','Activity calendar')}<ChevronRight size={16}/></NavLink>
      </section>
    </div>
    <div className="dashboard-shortcuts">
      <NavLink to="/progress"><BarChart3 size={17}/>{l(lang,'Когнитивный профиль','Skill profile')}<ChevronRight size={15}/></NavLink>
      <NavLink to="/rating"><Trophy size={17}/>{l(lang,'Рейтинг игроков','Player leaderboard')}<ChevronRight size={15}/></NavLink>
      {profile.favorites.length > 0 && <NavLink to="/games?show=favorites"><Star size={17}/>{l(lang,'Любимые упражнения','Favorite exercises')}<ChevronRight size={15}/></NavLink>}
      <NavLink to="/shop"><ShoppingBag size={17}/>{l(lang,'Магазин','Shop')}<ChevronRight size={15}/></NavLink>
    </div>
  </>;
}

function Games({ profile,lang,start }: { profile:Profile; lang:Lang; start:(queue:Queue)=>void }) {
  const state = useData();
  const loc = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(loc.search);
  const selected = params.get('skill');
  const [order,setOrder] = useState('catalog');
  const filtered = games.filter(game => (!selected || game.skill === selected) && !state.disabled.includes(game.id) && (params.get('show') !== 'favorites' || profile.favorites.includes(game.id)));
  const counts = (id: string) => profile.history.filter(item => item.game === id).length;
  if (order === 'popular') filtered.sort((a,b) => counts(b.id) - counts(a.id));
  const testGames = skillIds.map(skill => games.find(game => game.skill === skill && !state.disabled.includes(game.id))?.id).filter((id):id is string => Boolean(id));
  return <>
    <PageTop title={l(lang,'Тренировки','Training')}>{l(lang,'Выбери навык и начинай в своём темпе.','Choose a skill and go at your own pace.')}</PageTop>
    <div className="card placement-banner"><span className="panel-icon mint"><Target size={23}/></span><div><h3>{l(lang,'Вводная тренировка','Placement workout')}</h3><p>{l(lang,'По одному упражнению на каждое направление','One exercise for each available skill')}</p></div>
      <button className="secondary" disabled={!testGames.length} onClick={() => start({kind:'placement',games:testGames})}>{l(lang,'Пройти','Begin')}<ChevronRight size={17}/></button></div>
    <div className="filters">
      <div className="pills"><button aria-pressed={!selected && !params.get('show')} onClick={() => navigate('/games')}>{l(lang,'Все','All')}</button>
        {skillIds.map(skill => <button key={skill} aria-pressed={selected === skill} onClick={() => navigate('/games?skill='+skill)}>{local(skills[skill].names,lang)}</button>)}
        <button aria-pressed={params.get('show') === 'favorites'} onClick={() => navigate('/games?show=favorites')}>{l(lang,'Избранное','Favorites')}</button></div>
      <div className="filter-controls"><select aria-label={l(lang,'Сортировка','Sort')} value={order} onChange={event => setOrder(event.target.value)}><option value="catalog">{l(lang,'По порядку','Catalog order')}</option><option value="popular">{l(lang,'Часто играю','Most played')}</option></select></div>
    </div>
    {filtered.length ? <div className="catalog-grid">{filtered.map(game => {
      const favorite = profile.favorites.includes(game.id);
      return <div key={game.id} className="card exercise-card"><div className="exercise-top"><SkillIcon id={game.skill}/><button className="icon-button favorite-button" aria-label={l(lang,'В избранное','Favorite')} aria-pressed={favorite}
        onClick={() => state.profile({favorites:favorite ? profile.favorites.filter(id => id !== game.id) : [...profile.favorites,game.id]})}><Star size={18}/></button></div>
        <div><small>{local(skills[game.skill].names,lang)}</small><h3>{local(game.name,lang)}</h3><p>{local(game.rule,lang)}</p></div>
        <button className="secondary" onClick={() => start({kind:'free',games:[game.id]})}><Play size={15}/>{l(lang,'Играть','Play')}<ArrowRight size={16}/></button></div>;
    })}</div> : <div className="card empty">{l(lang,'В этой подборке пока нет упражнений.','There are no exercises in this collection yet.')}</div>}
  </>;
}

function Onboarding({ lang,onClose,onComplete }: { lang:Lang; onClose:()=>void; onComplete:()=>void }) {
  const state = useData();
  const [step,setStep] = useState(state.account ? 1 : 0);
  const firstStep = state.account ? 1 : 0;
  const [mode,setMode] = useState<'demo'|'personal'>(state.mode);
  const [chosen,setChosen] = useState<Skill[]>(activeProfile(state).goals);
  const [minutes,setMinutes] = useState(activeProfile(state).minutes);
  useEffect(() => {
    function escape(event:KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown',escape);
    return () => window.removeEventListener('keydown',escape);
  },[onClose]);
  function next() {
    if (step < 2) return setStep(step+1);
    state.configure({mode,onboarding:true});
    state.profile({goals:chosen,minutes});
    onComplete();
  }
  return <div className="modal-overlay" onClick={onClose}>
    <motion.section initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} className="card modal" role="dialog" aria-modal="true" aria-label={l(lang,'Настроить IQUP','Set up IQUP')} onClick={event => event.stopPropagation()}>
      <div className="modal-top"><span>IQUP · {step+1-firstStep}/{3-firstStep}</span><button className="icon-button" onClick={onClose} aria-label={l(lang,'Закрыть','Close')}><X size={19}/></button></div>
      {step === 0 ? <><div className="onboarding-symbol" aria-hidden="true"><Brain size={25} strokeWidth={1.85}/></div><h2>{l(lang,'Добро пожаловать в IQUP','Welcome to IQUP')}</h2><p>{l(lang,'Выбери режим тренировки.','Choose a workout mode.')}</p>
        <div className="pills centered-pills"><button aria-pressed={mode === 'personal'} onClick={() => setMode('personal')}>{state.account ? l(lang,'Личный режим','Personal mode') : l(lang,'Гостевой режим','Guest mode')}</button><button aria-pressed={mode === 'demo'} onClick={() => setMode('demo')}>{l(lang,'Демо-режим','Demo mode')}</button></div></>
        : step === 1 ? <><h2>{l(lang,'Что будем тренировать?','What do you want to train?')}</h2><p>{l(lang,'Выбери одно или несколько направлений.','Choose one or more skills.')}</p><div className="pills centered-pills">
          {skillIds.map(skill => <button key={skill} aria-pressed={chosen.includes(skill)} onClick={() => setChosen(chosen.includes(skill) ? chosen.filter(id => id !== skill) : [...chosen,skill])}>{local(skills[skill].names,lang)}</button>)}
        </div></> : <><h2>{l(lang,'Сколько времени в день?','How much time per day?')}</h2><p>{l(lang,'Тренировка дня подстроится под тебя.','Your daily workout adapts to your schedule.')}</p><div className="pills centered-pills">
          {[5,10,15,20].map(value => <button key={value} aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value} {l(lang,'мин','min')}</button>)}</div></>}
      <div className="game-tools">{step > firstStep && <button className="secondary" onClick={() => setStep(step-1)}><ChevronLeft size={18}/>{l(lang,'Назад','Back')}</button>}<button disabled={!chosen.length} className="primary" onClick={next}>{step === 2 ? l(lang,'Готово','Done') : l(lang,'Дальше','Next')}<ArrowRight size={19}/></button></div>
    </motion.section></div>;
}

function App() {
  const state = useData();
  const { t,i18n } = useTranslation();
  const lang = state.lang;
  const profile = activeProfile(state);
  const demo = state.mode === 'demo';
  const location = useLocation();
  const navigate = useNavigate();
  const [session,setSession] = useState<Queue>();
  const [onboarding,setOnboarding] = useState(false);
  const [from,setFrom] = useState('/games');
  const [,setCurrentDay] = useState(dateKey);
  const identity = useCloud(state => state.user);
  const insideTelegram = Boolean(telegram()?.initData);
  const signedIn = Boolean(identity && state.account);

  useEffect(() => startCloud(),[]);

  useEffect(() => {
    const refreshDate = () => setCurrentDay(dateKey());
    const timer = window.setInterval(refreshDate,60000);
    document.addEventListener('visibilitychange',refreshDate);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange',refreshDate); };
  },[]);

  useEffect(() => {
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  },[i18n,lang]);
  useEffect(() => {
    window.scrollTo(0,0);
    if (location.pathname !== '/play') setSession(undefined);
  },[location.pathname]);
  useEffect(() => {
    const app = telegram();
    if (!app?.initData) return;
    const handler = () => navigate(location.pathname === '/play' ? from : '/home');
    const back = app.BackButton;
    back?.onClick(handler);
    if (location.pathname === '/home') back?.hide(); else back?.show();
    return () => back?.offClick(handler);
  },[navigate,location.pathname,from,insideTelegram]);
  useEffect(() => initTelegram(),[insideTelegram]);

  function start(queue:Queue) {
    if (!queue.games.length) return;
    setFrom(location.pathname + location.search);
    setSession(queue);
    navigate('/play');
  }
  function close() { navigate(from); }
  const theme = themes.find(item => item.id === profile.theme) ?? themes[0];
  if (insideTelegram && !signedIn) return <main className="telegram-entry">
    <Logo/>
    <CloudPanel lang={lang}/>
  </main>;
  const pages = <Routes>
    <Route path="/home" element={<Dashboard profile={profile} lang={lang} demo={demo} identity={identity} start={start}/>}/>
    <Route path="/games" element={<Games profile={profile} lang={lang} start={start}/>}/>
    <Route path="/career" element={<CareerPage profile={profile} lang={lang} start={start}/>}/>
    <Route path="/progress" element={<ProgressPage profile={profile} lang={lang}/>}/>
    <Route path="/rating" element={<Leaderboard profile={profile} lang={lang}/>}/>
    <Route path="/support" element={<SupportPage lang={lang}/>}/>
    <Route path="/admin" element={<AdminPage lang={lang}/>}/>
    <Route path="/shop" element={<Shop profile={profile} lang={lang}/>}/>
    <Route path="/profile" element={signedIn && state.account
      ? <ProfilePage profile={profile} lang={lang} demo={demo} identity={identity}/>
      : <GuestProfilePage lang={lang}/>}/>
    <Route path="/settings" element={<ProfilePage profile={profile} lang={lang} demo={demo} identity={identity} settings onSetup={() => setOnboarding(true)}/>}/>
    <Route path="/play" element={session ? <Session queue={session} onClose={close}/> : <Navigate to="/games" replace/>}/>
    <Route path="*" element={<Navigate to="/home" replace/>}/>
  </Routes>;
  return <div className="app-layout" data-reduced={state.reduced} data-theme={theme.id} style={{'--theme-base':theme.colors[0],'--theme-accent':theme.colors[1]} as CSSProperties}>
    <Sidebar profile={profile} lang={lang} signedIn={signedIn}/><div className="app-main"><Header profile={profile} lang={lang} demo={demo} identity={identity}/>
      <main className="content" aria-label={t(location.pathname.slice(1))}><Suspense fallback={<p className="empty" role="status">{l(lang,'Загрузка…','Loading…')}</p>}>{pages}</Suspense>
        {location.pathname === '/home' && <footer><button className="text-link" onClick={() => setOnboarding(true)}><BookOpen size={16}/>{l(lang,'Настроить тренировку','Set up workouts')}</button><NavLink className="text-link" to="/settings"><Settings size={16}/>{l(lang,'Настройки','Settings')}</NavLink></footer>}
      </main></div><MobileNav lang={lang} signedIn={signedIn}/>
    <AnimatePresence>{onboarding && <Onboarding lang={lang} onClose={() => setOnboarding(false)} onComplete={() => {setOnboarding(false);navigate('/home');}}/>}</AnimatePresence>
  </div>;
}

let mounted = false;
const telegramLaunchKey = 'iqup.telegram-launch';
function wasTelegramLaunch() {
  try { return sessionStorage.getItem(telegramLaunchKey) === '1'; } catch { return false; }
}
function mount() {
  if (telegram()?.initData) {
    try { sessionStorage.setItem(telegramLaunchKey,'1'); } catch { /* Telegram can still open the app. */ }
  }
  if (mounted) {
    if (telegram()?.initData) syncCloud();
    return;
  }
  mounted = true;
  createRoot(document.getElementById('root')!).render(<HashRouter><App/></HashRouter>);
}
if (!telegram() && (wasTelegramLaunch() || /(?:#|[?&])tgWebApp/.test(window.location.href))) {
  const script = document.createElement('script');
  const timeout = window.setTimeout(mount,5000);
  const done = () => { window.clearTimeout(timeout); mount(); };
  script.src = 'https://telegram.org/js/telegram-web-app.js';
  script.onload = done;
  script.onerror = done;
  document.head.append(script);
} else mount();
