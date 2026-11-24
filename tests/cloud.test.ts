import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProfile, useData } from '../src/progress';
import { importLocal, resolveConflict, startCloud, useCloud } from '../src/cloud';
import { createSession, sessionKey, verifySession, verifyTelegram } from '../supabase/functions/iqup-telegram/auth';

const user = {id:'1234567890',name:'Ранис',username:'iq_test',language:'ru'};
const profile = (xp:number) => ({...emptyProfile(),xp});
const calls = vi.fn();
const launchData = {initData:'signed-launch'};
vi.mock('../src/telegram', () => ({telegram:() => launchData}));
vi.mock('../src/telegram-cloud', () => ({
  telegramCloudConfigured:true,
  signInTelegram:() => calls({action:'login',initData:launchData.initData}),
  telegramRequest:(payload:unknown) => calls(payload),
  TelegramCloudError:class extends Error { constructor(readonly status:number) { super('cloud'); } },
}));

beforeEach(() => {
  const storage = new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string) => storage.get(key) ?? null,setItem:(key:string,value:string) => storage.set(key,value)});
  vi.stubGlobal('window',{setTimeout,clearTimeout,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  calls.mockReset();
  launchData.initData = 'signed-launch';
  useData.setState({account:undefined,personal:emptyProfile(),mode:'personal'});
  useCloud.setState({phase:'checking',user:undefined,canImport:false});
});

describe('Telegram cloud', () => {
  it('never contacts the backend or loads an account outside Telegram', () => {
    launchData.initData = '';
    const stop = startCloud();
    try {
      expect(useCloud.getState().phase).toBe('signed-out');
      expect(useData.getState().account).toBeUndefined();
      expect(calls).not.toHaveBeenCalled();
    } finally { stop(); }
  });

  it('loads only the verified Telegram account and imports guest progress with consent', async () => {
    calls.mockImplementation(async ({action,token}) => {
      if (action === 'login') return {user,token:'session',expires:Math.floor(Date.now() / 1000) + 60};
      expect(token).toBe('session');
      if (action === 'read') return {revision:0,profile:null};
      return {revision:1};
    });
    useData.setState({personal:profile(19)});
    const stop = startCloud();
    try {
      await vi.waitFor(() => expect(useCloud.getState().phase).toBe('ready'));
      expect(useCloud.getState().user).toEqual(user);
      expect(useData.getState().account?.xp).toBe(0);
      expect(useCloud.getState().canImport).toBe(true);
      importLocal();
      await vi.waitFor(() => expect(calls).toHaveBeenCalledWith({action:'save',token:'session',revision:0,profile:profile(19)}));
    } finally { stop(); }
    expect(useData.getState().personal.xp).toBe(19);
    expect(useData.getState().account).toBeUndefined();
  });

  it('reports revision conflicts without deleting the pending edits', async () => {
    let revision = 1;
    calls.mockImplementation(async ({action}) => {
      if (action === 'login') return {user,token:'session',expires:Math.floor(Date.now() / 1000) + 60};
      if (action === 'read') return {revision,profile:profile(revision * 10)};
      return {revision:revision === 2 ? null : revision + 1};
    });
    const stop = startCloud();
    try {
      await vi.waitFor(() => expect(useCloud.getState().phase).toBe('ready'));
      revision = 2;
      useData.getState().profile({xp:42});
      await vi.waitFor(() => expect(useCloud.getState().phase).toBe('conflict'));
      expect(useData.getState().account?.xp).toBe(42);
      resolveConflict(false);
      expect(useData.getState().account?.xp).toBe(20);
    } finally { stop(); }
  });
});

describe('Telegram launch and sessions', () => {
  const now = 1795560000;
  const botId = '9065894849';
  it('checks the signed identity, bot ID, timestamp, and duplicate launch fields', async () => {
    const {publicKey,privateKey} = await crypto.subtle.generateKey('Ed25519',false,['sign','verify']) as CryptoKeyPair;
    const json = JSON.stringify({id:Number(user.id),first_name:user.name,username:user.username,language_code:'ru',photo_url:'https://t.me/i/test.jpg'});
    const data = 'auth_date=' + now + '\nquery_id=Q123\nuser=' + json;
    const bytes = await crypto.subtle.sign('Ed25519',privateKey,new TextEncoder().encode(botId + ':WebAppData\n' + data));
    const signature = Buffer.from(bytes).toString('base64url');
    const params = new URLSearchParams({user:json,hash:'ignored by Telegram Ed25519',signature,query_id:'Q123',auth_date:String(now)});
    expect(await verifyTelegram(params.toString(),botId,publicKey,now)).toEqual({...user,photo:'https://t.me/i/test.jpg'});
    expect(await verifyTelegram(params.toString(),'10',publicKey,now)).toBeNull();
    expect(await verifyTelegram(params.toString(),botId,publicKey,now + 901)).toBeNull();
    expect(await verifyTelegram(params.toString() + '&auth_date=' + now,botId,publicKey,now)).toBeNull();
    params.set('user',json.replace('1234567890','1234567891'));
    expect(await verifyTelegram(params.toString(),botId,publicKey,now)).toBeNull();
  });

  it('binds the session to the verified account and rejects wrong bot, token and expiry', async () => {
    const key = await sessionKey('local test secret');
    const {token,expires} = await createSession(key,botId,user.id,now);
    expect(await verifySession(key,botId,token,now)).toBe(user.id);
    expect(await verifySession(key,'1',token,now)).toBeNull();
    expect(await verifySession(key,botId,token,expires)).toBeNull();
    expect(await verifySession(key,botId,'A' + token,now)).toBeNull();
  });
});
