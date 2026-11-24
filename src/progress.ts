import { create } from 'zustand';
import { byId, games, chapters, cosmeticById, skillIds, type CosmeticType, type Lang, type Skill } from './catalog';
import { seeded, shuffle } from './engine';

export const storageKey = 'iqup.v3';
export type Result = { id: string; game: string; day: string; at: number; level: number; stage?: number; correct: number; total: number; duration: number; reaction?: number; xp: number; score: number; record?: boolean; demo?: boolean };
type Ledger = { id: string; date: string; label: string; coins: number; xp?: number };
type Ticket = { id: string; text: string; closed: boolean; response?: string };
type Plan = { day: string; games: string[]; completed: boolean };
export type Profile = {
  name: string; xp: number; coins: number; history: Result[]; ledger: Ledger[]; owned: string[]; theme: string; equipped: Partial<Record<CosmeticType,string>>;
  goals: Skill[]; minutes: number; completedDays: string[]; dailyPlans: Record<string, Plan>;
  achievements: Record<string, string>; claimed: string[]; career: Record<number, number>; favorites: string[];
  friends: string[]; privacy: boolean; age: string; reports: boolean; tickets: Ticket[];
};
type Snapshot = { version: 3; mode: 'demo' | 'personal'; lang: Lang; onboarding: boolean; reduced: boolean; sound: boolean; haptics: boolean; personal: Profile; demo: Profile; disabled: string[]; dailyBonus: number; broadcasts: string[] };
export interface DataProvider {
  load(): Snapshot;
  save(data: Snapshot): void;
}

export const economy = { gameXP: 20, accuracyXP: 15, recordXP: 25, dailyXP: 100, dailyCoins: 30, levelCoins: 50 };
export const dateKey = (date = new Date()) => {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
};
export function offsetDate(days: number, date = new Date()) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
export function weekKey(date = new Date()) {
  return dateKey(offsetDate(-((date.getDay() + 6) % 7), date));
}
export const accuracy = (result: Pick<Result,'correct'|'total'>) => result.total > 0 ? Math.round(Math.min(1, result.correct / result.total) * 100) : 0;
export function levelInfo(xp: number) {
  const level = Math.max(1, Math.floor((-175 + Math.sqrt(175 ** 2 + 200 * Math.max(0,xp))) / 50) + 1);
  const spent = (level - 1) * (100 + (level - 2) * 12.5);
  const needed = 100 + (level - 1) * 25;
  return { level, spent: xp - spent, needed };
}
export function streak(days: string[]) {
  const dates = new Set(days);
  let current = 0;
  const start = dates.has(dateKey()) ? 0 : -1;
  while (dates.has(dateKey(offsetDate(start - current)))) current++;
  let best = 0;
  let run = 0;
  let previous = '';
  for (const day of [...dates].sort()) {
    const [year,month,date] = day.split('-').map(Number);
    const yesterday = dateKey(offsetDate(-1,new Date(year,month - 1,date)));
    run = yesterday === previous ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best };
}

export function emptyProfile(): Profile {
  return { name: '', xp: 0, coins: 0, history: [], ledger: [], owned: ['classic'], theme: 'classic', equipped:{}, goals: [...skillIds], minutes: 5,
    dailyPlans: {}, completedDays: [], achievements: {}, claimed: [], career: {}, favorites: [],
    friends: [], privacy: true, age: '', reports: false, tickets: [] };
}
function demoProfile(): Profile {
  const profile = emptyProfile();
  const sample = ['memory','patterns','focus','math','reaction','digits','stroop','pairs','compare','quick','missing','shapes'];
  const history = sample.map((game, index) => {
    const daysAgo = 1 + Math.floor(index / 2);
    return { id: `sample-${index}`, game, day: dateKey(offsetDate(-daysAgo)), at: offsetDate(-daysAgo).getTime(),
      level: 2 + index % 3, correct: 3 + (index * 7) % 3, total: 5, duration: 35 + index * 2, xp: 25 + index * 2, score: 59 + index * 2, demo: true };
  });
  return { ...profile, name: 'Алекс', xp: 412, coins: 285, history, owned: ['classic','ocean'], friends: ['mira','nika'], favorites: ['math','memory'],
    completedDays: [-1,-2,-3].map(days => dateKey(offsetDate(days))), ledger: [{ id:'sample', date:dateKey(offsetDate(-1)), label:'initialDemo', coins:285, xp:412 }],
    achievements: { first: dateKey(offsetDate(-6)), five: dateKey(offsetDate(-4)), streak3: dateKey(offsetDate(-1)) } };
}
const initial = (): Snapshot => ({ version: 3, mode: 'personal', lang: 'ru', onboarding: false, reduced: false, sound: false, haptics:true, personal: emptyProfile(), demo: demoProfile(), disabled: [], dailyBonus: economy.dailyXP, broadcasts: [] });
const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function safeProfile(candidate: unknown, fallback: Profile = emptyProfile()): Profile {
  if (!candidate || typeof candidate !== 'object') return fallback;
  const source = candidate as Partial<Profile>;
  const profile = { ...fallback };
  for (const key of ['xp','coins','minutes'] as const) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) profile[key] = Math.floor(value);
  }
  for (const key of ['privacy','reports'] as const) if (typeof source[key] === 'boolean') profile[key] = source[key];
  for (const key of ['name','age','theme'] as const) if (typeof source[key] === 'string') profile[key] = source[key].slice(0,40);
  for (const key of ['completedDays','owned','claimed','favorites','friends'] as const) {
    const value = source[key];
    if (Array.isArray(value)) profile[key] = [...new Set(value.filter((item): item is string => typeof item === 'string'))];
  }
  profile.completedDays = profile.completedDays.filter(validDay);
  profile.owned = ['classic',...profile.owned.filter(id => id !== 'classic' && cosmeticById[id])];
  profile.theme = profile.owned.includes(profile.theme) && cosmeticById[profile.theme]?.type === 'theme' ? profile.theme : 'classic';
  profile.equipped = {};
  if (source.equipped && typeof source.equipped === 'object') {
    for (const [type,id] of Object.entries(source.equipped)) {
      if (typeof id === 'string' && profile.owned.includes(id) && cosmeticById[id]?.type === type) profile.equipped[cosmeticById[id].type] = id;
    }
  }
  profile.goals = Array.isArray(source.goals) ? source.goals.filter(value => skillIds.includes(value)) : fallback.goals;
  if (!profile.goals.length) profile.goals = [...skillIds];
  if (![5,10,15,20].includes(profile.minutes)) profile.minutes = 5;
  if (Array.isArray(source.history)) profile.history = source.history.filter(item => item && typeof item.id === 'string' && byId[item.game] && validDay(item.day)
    && [item.at,item.level,item.correct,item.total,item.duration,item.xp,item.score].every(Number.isFinite));
  if (Array.isArray(source.ledger)) profile.ledger = source.ledger.filter(item => item && validDay(item.date) && typeof item.label === 'string' && Number.isFinite(item.coins));
  if (Array.isArray(source.tickets)) profile.tickets = source.tickets.filter(item => item && typeof item.id === 'string' && typeof item.text === 'string');
  for (const key of ['achievements','career'] as const) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(profile[key],value);
  }
  if (source.dailyPlans && typeof source.dailyPlans === 'object') {
    profile.dailyPlans = Object.fromEntries(Object.entries(source.dailyPlans).filter(([day,plan]) => validDay(day) && plan?.day === day && Array.isArray(plan.games) && plan.games.length > 0 && plan.games.every(id => byId[id])));
  }
  return profile;
}

export class LocalStorageProvider implements DataProvider {
  load(): Snapshot {
    const fallback = initial();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Snapshot | null;
      if (saved?.version === 3) {
        return { ...fallback, mode: saved.mode === 'demo' && saved.onboarding === true ? 'demo' : 'personal', lang: saved.lang === 'en' ? 'en' : 'ru',
          onboarding: saved.onboarding === true, reduced: saved.reduced === true, sound: saved.sound === true, haptics:saved.haptics !== false, personal: safeProfile(saved.personal,fallback.personal),
          demo: safeProfile(saved.demo,fallback.demo), disabled: Array.isArray(saved.disabled) ? saved.disabled.filter(id => byId[id]) : [],
          broadcasts: Array.isArray(saved.broadcasts) ? saved.broadcasts.filter(item => typeof item === 'string') : [],
          dailyBonus: Number.isFinite(saved.dailyBonus) ? Math.max(0,Math.min(500,saved.dailyBonus)) : economy.dailyXP };
      }
      const legacy = JSON.parse(localStorage.getItem('iqup_mvp_progress_v2') || localStorage.getItem('iqup_mvp_progress_v1') || 'null');
      if (!legacy || typeof legacy !== 'object') return fallback;
      type LegacyResult = { type: string; day: string; at?: number; xp?: number };
      const history: LegacyResult[] = Array.isArray(legacy.history) ? legacy.history : [];
      const relevant = history.filter(item => item && byId[item.type] && validDay(item.day));
      fallback.personal = safeProfile({ ...legacy, theme: legacy.skin, history: relevant.map((item,index) => ({
        id: `legacy-${index}`, game:item.type, day:item.day, at:item.at ?? 0, level:1,correct:0,total:0,duration:0,xp:item.xp ?? 0,score:0,
      })) },fallback.personal);
      fallback.mode = 'personal';
      fallback.onboarding = true;
    } catch { /* Broken browser storage starts with a clean profile. */ }
    return fallback;
  }
  save(data: Snapshot) {
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* The open app still works in memory. */ }
  }
}

export function makePlan(profile: Profile, disabled: string[] = [], day = dateKey()): Plan {
  const stored = profile.dailyPlans[day];
  if (stored?.completed || (stored && !stored.games.some(id => disabled.includes(id)))) return stored;
  const rng = seeded(Number(day.replaceAll('-','')));
  const perSkill = profile.goals.map(skill => {
    const results = profile.history.filter(result => byId[result.game]?.skill === skill && result.total).slice(0,8);
    return { skill, score: results.length ? results.reduce((sum, result) => sum + accuracy(result),0) / results.length : 65 };
  });
  perSkill.sort((a,b) => a.score - b.score);
  const pool = shuffle(games.filter(item => !disabled.includes(item.id)),rng);
  const recent = new Set(profile.history.filter(result => result.day !== day).slice(0,4).map(result => result.game));
  pool.sort((a,b) => Number(recent.has(a.id)) - Number(recent.has(b.id)));
  const count = profile.minutes === 5 ? 3 : Math.min(6, profile.minutes / 5 + 2);
  const result = perSkill.slice(0,count).map(({skill}) => pool.find(item => item.skill === skill)?.id).filter((id): id is string => Boolean(id));
  for (const item of pool) {
    if (result.length >= count) break;
    if (!result.includes(item.id)) result.push(item.id);
  }
  return { day, games:result, completed:false };
}
const milestones = [3,7,14,30,50,100];
type Achievement = { id: string; title: readonly [string,string]; target: number; evaluate: (profile: Profile) => number; coins: number; rarity: number };
function badge(id: string, title: Achievement['title'], target: number, evaluate: Achievement['evaluate'], rarity = 0): Achievement {
  return { id,title,target,evaluate,coins:25 + rarity * 25,rarity };
}
export const badges = [
  badge('first',['Первый шаг','First step'],1,p => p.history.length),
  badge('five',['Разминка','Warm-up'],5,p => p.history.length),
  badge('twenty',['Вошёл во вкус','On a roll'],20,p => p.history.length,1),
  badge('fifty',['Постоянство','Consistency'],50,p => p.history.length,2),
  badge('hundred',['Сто тренировок','One hundred sessions'],100,p => p.history.length,3),
  ...milestones.map(days => badge(`streak${days}`,[`Серия: ${days} дней`,`${days}-day streak`],days,p => streak(p.completedDays).best,days < 14 ? 1 : 2)),
  badge('flawless',['Без ошибок','Flawless'],1,p => p.history.filter(r => accuracy(r) === 100).length),
  badge('flawless10',['Десять идеальных','Ten perfect runs'],10,p => p.history.filter(r => accuracy(r) === 100).length,2),
  badge('all',['Универсал','All-rounder'],25,p => new Set(p.history.map(r => r.game)).size,3),
  badge('collector',['Коллекционер','Collector'],5,p => p.owned.filter(id => id !== 'classic').length,3),
  badge('explorer',['Исследователь','Explorer'],5,p => new Set(p.history.map(r => byId[r.game]?.skill)).size,1),
  badge('legend',['Легенда IQUP','IQUP legend'],25,p => levelInfo(p.xp).level,3),
  badge('career',['Пройденный путь','Road completed'],6,p => Object.keys(p.career).length,3),
  badge('firstDaily',['День в зачёт','Day complete'],1,p => p.completedDays.length),
  badge('daily10',['Десять активных дней','Ten active days'],10,p => p.completedDays.length,2),
  ...skillIds.flatMap((skill,index) => {
    const names = [['Железная память','Iron memory'],['Мастер логики','Logic master'],['Острый глаз','Sharp eye'],['Быстрый ответ','Quick response'],['Математик','Mathematician']] as const;
    const results = (p: Profile) => p.history.filter(r => byId[r.game]?.skill === skill);
    return [
      badge(skill,names[index],skill === 'math' ? 100 : 25,p => results(p).reduce((sum,r) => sum + r.correct,0),1),
      badge(skill+'Pro',[`${names[index][0]} II`,`${names[index][1]} II`],5,p => results(p).filter(r => accuracy(r) >= 90).length,2),
    ];
  }),
];

export function quests(profile: Profile, day = dateKey(), week = weekKey()) {
  const daily = profile.history.filter(item => item.day === day && !item.demo);
  const weekly = profile.history.filter(item => item.day >= week && !item.demo);
  return [
    { id:day+'-play', name:['Пройди 3 упражнения','Play 3 exercises'], progress:daily.length, target:3, xp:50, coins:20, weekly:false },
    { id:day+'-memory', name:['Тренируй память','Train your memory'], progress:daily.filter(r => byId[r.game]?.skill === 'memory').length, target:1, xp:50, coins:15, weekly:false },
    { id:day+'-accuracy', name:['Получи 80% точности','Reach 80% accuracy'], progress:Math.max(0,...daily.map(accuracy)), target:80, xp:50, coins:15, weekly:false },
    { id:week+'-daily', name:['Выполни 5 тренировок дня','Complete 5 daily workouts'], progress:profile.completedDays.filter(day => day >= week && profile.dailyPlans[day]?.completed).length, target:5, xp:250, coins:100, weekly:true },
    { id:week+'-play', name:['Пройди 25 упражнений','Play 25 exercises'], progress:weekly.length, target:25, xp:250, coins:100, weekly:true },
    { id:week+'-skills', name:['Попробуй все направления','Try every skill'], progress:new Set(weekly.map(r => byId[r.game]?.skill)).size, target:5, xp:250, coins:100, weekly:true },
  ] as const;
}

function credit(profile: Profile, id: string, label: string, xp: number, coins: number): Profile {
  const newXp = profile.xp + xp;
  const levelCoins = Math.max(0,levelInfo(newXp).level - levelInfo(profile.xp).level) * economy.levelCoins;
  const entry = { id, date:dateKey(), label, coins, xp };
  const levelEntries = levelCoins ? [{ id:id+'-level', date:entry.date, label:'level', coins:levelCoins }] : [];
  return { ...profile, xp:newXp, coins:profile.coins + coins + levelCoins, ledger:[...levelEntries,entry,...profile.ledger] };
}
function unlock(profile: Profile) {
  for (const achievement of badges) {
    if (profile.achievements[achievement.id] || achievement.evaluate(profile) < achievement.target) continue;
    profile = credit({ ...profile, achievements:{ ...profile.achievements, [achievement.id]:dateKey() } },'badge-'+achievement.id,'achievement',10,achievement.coins);
  }
  return profile;
}

type AccountState = { account?: Profile };

export function activeProfile(state: Snapshot & AccountState) {
  return state.mode === 'personal' ? state.account ?? state.personal : state.demo;
}

type Actions = {
  configure(value: Partial<Pick<Snapshot,'mode'|'lang'|'onboarding'|'reduced'|'sound'|'haptics'|'disabled'|'dailyBonus'|'broadcasts'>>): void;
  profile(value: Partial<Profile>): void; resetProfile(): void; startPlan(): Plan; result(value: Omit<Result,'day'|'at'|'xp'|'score'>): Result | undefined;
  completeDaily(): boolean; career(index: number, resultIds: readonly string[]): boolean; claim(id: string): boolean; buy(id: string): boolean;
};
const provider = new LocalStorageProvider();
export const useData = create<Snapshot & AccountState & Actions>((set,get) => {
  function update(value: Partial<Snapshot>) {
    const prev = get();
    const data: Snapshot = { version:3, mode:prev.mode,lang:prev.lang,onboarding:prev.onboarding,reduced:prev.reduced,sound:prev.sound,haptics:prev.haptics,
      personal:prev.personal,demo:prev.demo,disabled:prev.disabled,dailyBonus:prev.dailyBonus,broadcasts:prev.broadcasts,...value };
    provider.save(data);
    set(data);
  }
  function write(profile: Profile) {
    const state = get();
    if (state.mode === 'personal' && state.account) set({account:profile});
    else update({ [state.mode]:profile });
  }
  return {
    ...provider.load(),
    configure: update,
    profile: value => write({ ...activeProfile(get()),...value }),
    resetProfile: () => write(get().mode === 'demo' ? demoProfile() : emptyProfile()),
    startPlan() {
      const state = get();
      const profile = activeProfile(state);
      const plan = makePlan(profile,state.disabled);
      if (profile.dailyPlans[plan.day] !== plan) write({ ...profile,dailyPlans:{ ...profile.dailyPlans,[plan.day]:plan } });
      return plan;
    },
    result(value) {
      const state = get();
      const profile = activeProfile(state);
      if (profile.history.some(item => item.id === value.id) || !byId[value.game]) return;
      const day = dateKey();
      const percent = accuracy(value);
      const score = value.total === 0 ? 0 : Math.min(100,Math.round(percent * (.52 + value.level * .048) + Math.min(10, 35 / Math.max(3, value.duration / Math.max(value.total,1)))));
      const previous = profile.history.filter(item => item.game === value.game && !item.demo);
      const record = previous.length > 0 && score > Math.max(...previous.map(item => item.score));
      const sameDay = previous.some(item => item.day === day);
      const baseXp = economy.gameXP + Math.round(economy.accuracyXP * percent / 100) + (record ? economy.recordXP : 0);
      const xp = sameDay ? Math.max(3,Math.floor(baseXp / 3)) : baseXp;
      const item = { ...value,xp,score,day,record,at:Date.now() };
      write(unlock(credit({ ...profile, history:[item,...profile.history] },item.id,value.game,xp,sameDay ? 0 : 5 + Math.floor(percent / 10))));
      return item;
    },
    completeDaily() {
      const state = get();
      const profile = activeProfile(state);
      const day = dateKey();
      const plan = profile.dailyPlans[day];
      if (!plan?.games.length || plan.completed || !plan.games.every(game => profile.history.some(result => result.day === day && !result.demo && result.game === game))) return false;
      write(unlock(credit({ ...profile, completedDays:[...new Set([...profile.completedDays,day])],
        dailyPlans:{ ...profile.dailyPlans,[day]:{...plan,completed:true} } },day+'-daily','daily',state.dailyBonus,economy.dailyCoins)));
      return true;
    },
    career(index,resultIds) {
      const profile = activeProfile(get());
      const chapter = chapters[index];
      if (!chapter || (index > 0 && !profile.career[index-1])) return false;
      const results = resultIds.map(id => profile.history.find(result => result.id === id && !result.demo));
      if (!chapter.games.every(game => results.some(result => result?.game === game))) return false;
      const points = results.every(result => result && accuracy(result) === 100) ? 2 : 1;
      if ((profile.career[index] ?? 0) >= points) return false;
      const first = !profile.career[index];
      const next = { ...profile,career:{ ...profile.career,[index]:points } };
      write(unlock(first ? credit(next,`career-${index}`,'career',80,25) : next));
      return true;
    },
    claim(id) {
      const profile = activeProfile(get());
      const quest = quests(profile).find(value => value.id === id);
      if (!quest || quest.progress < quest.target || profile.claimed.includes(id)) return false;
      write(unlock(credit({ ...profile,claimed:[...profile.claimed,id] },id,'quest',quest.xp,quest.coins)));
      return true;
    },
    buy(id) {
      const profile = activeProfile(get());
      const item = cosmeticById[id];
      if (!item) return false;
      const equipped = item.type === 'theme' ? { theme:id } : { equipped:{...profile.equipped,[item.type]:id} };
      if (profile.owned.includes(id)) { write({ ...profile,...equipped }); return true; }
      if (profile.coins < item.cost) return false;
      write(unlock(credit({ ...profile,...equipped,owned:[...profile.owned,id] },'item-'+id,'purchase',0,-item.cost)));
      return true;
    },
  };
});
