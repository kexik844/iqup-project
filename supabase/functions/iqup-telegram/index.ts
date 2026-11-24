import { createSession, sessionKey, telegramPublicKey, verifySession, verifyTelegram } from './auth.ts';

const botId = Deno.env.get('TELEGRAM_BOT_ID')?.trim();
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const maxBodySize = 4 * 1024 * 1024;
const headers = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'apikey, content-type',
  'Cache-Control':'no-store',
};
let keys: Promise<[CryptoKey,CryptoKey]> | undefined;
const operations = new Set([
  'role','leaderboard','support','ticket_create','overview','players','queue','audit','moderate','ticket_update',
]);

function reply(status:number, body:unknown) {
  return Response.json(body,{status,headers});
}
async function bodyWithinLimit(request:Request) {
  if (Number(request.headers.get('Content-Length')) > maxBodySize) return;
  const reader = request.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let size = 0;
  let content = '';
  while (true) {
    const {done,value} = await reader.read();
    if (done) return content + decoder.decode();
    size += value.byteLength;
    if (size > maxBodySize) {
      await reader.cancel();
      return;
    }
    content += decoder.decode(value,{stream:true});
  }
}
async function database(path:string,body?:unknown) {
  const options = {apikey:serviceKey!, Authorization:'Bearer ' + serviceKey!, 'Content-Type':'application/json'};
  const response = await fetch(supabaseUrl + '/rest/v1/' + path,{
    method:body === undefined ? 'GET' : 'POST',
    headers:options,
    body:body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    console.error('IQUP Telegram database request failed',response.status);
    throw new Error('database');
  }
  return response.json();
}
function community(id:string|null, operation:string, args:Record<string,unknown> = {}) {
  return database('rpc/iqup_community',{actor:id,operation,args});
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return reply(405,{code:'method'});
  if (!botId || !/^\d{1,16}$/.test(botId) || !supabaseUrl || !serviceKey) return reply(503,{code:'setup'});
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return reply(415,{code:'content-type'});
  let input;
  try {
    const raw = await bodyWithinLimit(request);
    if (raw === undefined) return reply(413,{code:'size'});
    input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400,{code:'body'});
  } catch { return reply(400,{code:'body'}); }
  try {
    keys ??= Promise.all([
      crypto.subtle.importKey('raw',Uint8Array.from(telegramPublicKey.match(/../g)!,byte => parseInt(byte,16)), 'Ed25519',false,['verify']),
      sessionKey(serviceKey),
    ]);
    const [telegramKey,signingKey] = await keys;
    if (input.action === 'login') {
      const user = typeof input.initData === 'string' && await verifyTelegram(input.initData,botId,telegramKey);
      if (!user) return reply(401,{code:'launch'});
      // A new Edge deployment can still serve progress while the migration is being applied.
      await community(user.id,'register',{name:user.name}).catch(() => undefined);
      return reply(200,{user,...await createSession(signingKey,botId,user.id)});
    }
    const id = typeof input.token === 'string' && await verifySession(signingKey,botId,input.token);
    if (operations.has(input.action)) {
      if (!id && (input.action !== 'leaderboard' || input.token !== undefined)) return reply(401,{code:'session'});
      const args = input.args && typeof input.args === 'object' && !Array.isArray(input.args) ? input.args : {};
      const result = await community(id || null,input.action,args);
      if (result?.error) {
        const statuses:Record<string,number> = {forbidden:403,invalid:400,missing:404,conflict:409,limit:429};
        return reply(statuses[result.error] ?? 503,{code:result.error});
      }
      return reply(200,result);
    }
    if (!id) return reply(401,{code:'session'});
    if (input.action === 'read') {
      const rows = await database('iqup_telegram_progress?select=profile,revision&telegram_id=eq.' + id);
      return reply(200,rows[0] ?? {revision:0,profile:null});
    }
    if (input.action === 'save') {
      const { revision,profile } = input;
      if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647 || !profile || typeof profile !== 'object' || Array.isArray(profile)) {
        return reply(400,{code:'progress'});
      }
      const saved = await database('rpc/iqup_save_telegram_progress',{owner_id:id,expected_revision:revision,new_profile:profile});
      return reply(200,{revision:saved});
    }
    return reply(400,{code:'action'});
  } catch { return reply(503,{code:'backend'}); }
});
