import { create } from 'zustand';
import { safeProfile, storageKey, useData, type Profile } from './progress';
import { telegram } from './telegram';
import { signInTelegram, telegramCloudConfigured, telegramRequest, TelegramCloudError, type TelegramSession, type TelegramUser } from './telegram-cloud';

type Phase = 'checking'|'setup'|'signed-out'|'loading'|'ready'|'saving'|'error'|'reopen'|'conflict';
type CloudStatus = { phase:Phase; user?:TelegramUser; canImport:boolean };
export const useCloud = create<CloudStatus>(() => ({phase:'checking',canImport:false}));

export function communityRequest<T>(action:string,args:Record<string,unknown> = {}) {
  return telegramRequest<T>({action,args,token:account?.session.token});
}

type Copy = { revision:number; profile:Profile };
type Cache = Copy & { dirty:boolean };
type Account = { session:TelegramSession; copy?:Cache; conflict?:Copy; saving:boolean; refreshing:boolean; timer?:number };

let account: Account | undefined;
let launch: Promise<void> | undefined;
let generation = 0;
const cacheKey = (id:string) => 'iqup.cloud.telegram.v1.' + id;

function restore(id:string): Cache | undefined {
  try {
    const data = JSON.parse(localStorage.getItem(cacheKey(id)) ?? 'null') as Cache | null;
    if (data && Number.isSafeInteger(data.revision) && data.revision >= 0 && data.profile) {
      return { revision:data.revision,profile:safeProfile(data.profile),dirty:data.dirty === true };
    }
  } catch { /* If storage is unavailable, load the server copy. */ }
}
function remember(userId:string,copy:Cache) {
  try { localStorage.setItem(cacheKey(userId),JSON.stringify(copy)); } catch { /* The open tab can still sync. */ }
}
function setPhase(phase:Phase) { useCloud.setState({phase}); }
function handleFailure(error:unknown,current?:Account) {
  if (current && account !== current) return;
  const status = error instanceof TelegramCloudError ? error.status : undefined;
  if (status === 401) setPhase('reopen');
  else if (status === 404) setPhase('setup');
  else setPhase('error');
}

async function remoteCopy(current:Account): Promise<Copy> {
  const data = await telegramRequest<{revision:number;profile:unknown}>({action:'read',token:current.session.token});
  if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('Invalid cloud revision');
  return {revision:data.revision,profile:safeProfile(data.profile)};
}

function activate(current:Account,copy:Copy,dirty = false) {
  current.copy = {...copy,dirty};
  remember(current.session.user.id,current.copy);
  const store = useData.getState();
  if (store.mode !== 'personal') store.configure({mode:'personal'});
  useData.setState({account:copy.profile});
  const local = store.personal;
  useCloud.setState({canImport:copy.revision === 0 && !dirty && Boolean(local.xp || local.history.length || local.coins || local.favorites.length || local.tickets.length)});
}

async function refresh(current:Account) {
  if (current.refreshing || current.saving || current.conflict) return;
  current.refreshing = true;
  setPhase(current.copy ? 'saving' : 'loading');
  try {
    const remote = await remoteCopy(current);
    if (account !== current) return;
    if (!current.copy?.dirty) activate(current,remote);
    else if (current.copy.revision !== remote.revision) {
      current.conflict = remote;
      setPhase('conflict');
      return;
    }
    setPhase('ready');
  } catch (error) {
    handleFailure(error,current);
  } finally {
    current.refreshing = false;
  }
  if (account === current && useCloud.getState().phase === 'ready' && current.copy?.dirty) void flush(current);
}

async function flush(current:Account) {
  if (account !== current || current.saving || current.refreshing || current.conflict || !current.copy?.dirty) return;
  if (useCloud.getState().phase === 'reopen') return;
  const {profile,revision} = current.copy;
  current.saving = true;
  setPhase('saving');
  try {
    const {revision:saved} = await telegramRequest<{revision:number|null}>({action:'save',token:current.session.token,revision,profile});
    if (account !== current) return;
    if (saved === null) {
      const remote = await remoteCopy(current);
      if (account === current) {
        current.conflict = remote;
        setPhase('conflict');
      }
      return;
    }
    if (!Number.isSafeInteger(saved) || saved !== revision + 1) throw new Error('Unexpected cloud revision');
    const latest = current.copy.profile;
    current.copy = {revision:saved,profile:latest,dirty:latest !== profile};
    remember(current.session.user.id,current.copy);
    setPhase('ready');
  } catch (error) {
    handleFailure(error,current);
  } finally {
    current.saving = false;
  }
  if (account === current && useCloud.getState().phase === 'ready' && current.copy.dirty) void flush(current);
}

function detach() {
  window.clearTimeout(account?.timer);
  account = undefined;
  useData.setState({account:undefined});
  useCloud.setState({user:undefined,canImport:false});
}

function checkCloud() {
  if (!telegram()?.initData) return setPhase('signed-out');
  if (!telegramCloudConfigured) return setPhase('setup');
  if (launch) return launch;
  const requestGeneration = generation;
  setPhase('checking');
  launch = (async () => {
    try {
      const session = await signInTelegram();
      if (generation !== requestGeneration) return;
      if (!session.user?.id || !session.token || session.expires <= Date.now() / 1000) throw new Error('Invalid Telegram session');
      if (account?.session.user.id === session.user.id) {
        account.session = session;
        await refresh(account);
        return;
      }
      detach();
      const current:Account = {session,saving:false,refreshing:false};
      account = current;
      useCloud.setState({user:session.user,phase:'loading'});
      const cached = restore(session.user.id);
      try {
        if (!localStorage.getItem(storageKey) && session.user.language && !session.user.language.startsWith('ru')) {
          useData.getState().configure({lang:'en'});
        }
      } catch { /* The selected language stays in memory. */ }
      if (cached) activate(current,cached,cached.dirty);
      await refresh(current);
    } catch (error) {
      if (generation === requestGeneration) handleFailure(error);
    } finally {
      if (generation === requestGeneration) launch = undefined;
    }
  })();
  return launch;
}

export function startCloud() {
  const unsubscribe = useData.subscribe((state,previous) => {
    const current = account;
    if (!current?.copy || !state.account || state.account === previous.account || state.account === current.copy.profile) return;
    current.copy = {...current.copy,profile:state.account,dirty:true};
    remember(current.session.user.id,current.copy);
    useCloud.setState({canImport:false});
    window.clearTimeout(current.timer);
    if (!current.conflict) current.timer = window.setTimeout(() => { void flush(current); },350);
  });
  window.addEventListener('online',syncCloud);
  void checkCloud();
  return () => {
    generation++;
    launch = undefined;
    window.removeEventListener('online',syncCloud);
    unsubscribe();
    detach();
  };
}

export function syncCloud() {
  if (account && useCloud.getState().phase !== 'reopen') void refresh(account);
  else void checkCloud();
}
export function importLocal() {
  const current = account;
  if (!current?.copy || current.copy.revision !== 0 || !useCloud.getState().canImport || useCloud.getState().phase !== 'ready') return;
  const previous = safeProfile(useData.getState().personal);
  useData.setState({account:{...previous,name:''}});
}
export function resolveConflict(keepLocal:boolean) {
  const current = account;
  if (!current?.copy || !current.conflict) return;
  const remote = current.conflict;
  const profile = keepLocal ? current.copy.profile : remote.profile;
  current.conflict = undefined;
  activate(current,{revision:remote.revision,profile},keepLocal);
  setPhase('ready');
  if (keepLocal) void flush(current);
}
