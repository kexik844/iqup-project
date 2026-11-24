const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const telegramPublicKey = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
const launchLifetime = 15 * 60;
const sessionLifetime = 12 * 60 * 60;
const maxTelegramId = 2 ** 52 - 1;
const nowSeconds = () => Math.floor(Date.now() / 1000);

export type TelegramUser = {
  id: string;
  name: string;
  username?: string;
  photo?: string;
  language?: string;
};

function validId(id: number) {
  return Number.isSafeInteger(id) && id > 0 && id <= maxTelegramId;
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode(value: string) {
  if (!/^[\w-]+={0,2}$/.test(value)) throw new Error('Invalid base64url');
  return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c => c.charCodeAt(0));
}

export async function verifyTelegram(initData: string, botId: string, key: CryptoKey, now = nowSeconds()): Promise<TelegramUser | null> {
  if (initData.length > 16384) return null;
  const fields = new URLSearchParams(initData);
  const date = fields.get('auth_date') ?? '';
  const authDate = Number(date);
  const signature = fields.get('signature');
  if (!/^\d{1,10}$/.test(date) || authDate > now + 30 || now - authDate > launchLifetime || !signature) return null;
  const entries = [...fields.entries()];
  if (new Set(entries.map(([name]) => name)).size !== entries.length ||
      entries.some(([name,value]) => !/^[a-z_]+$/.test(name) || /[\r\n]/.test(value))) return null;
  fields.delete('hash');
  fields.delete('signature');
  fields.sort();
  const data = botId + ':WebAppData\n' + [...fields].map(([name,value]) => name + '=' + value).join('\n');
  try {
    const signatureBytes = decode(signature);
    if (signatureBytes.length !== 64 || !await crypto.subtle.verify('Ed25519',key,signatureBytes,encoder.encode(data))) return null;
    const user = JSON.parse(fields.get('user') ?? 'null');
    if (!user || !validId(user.id) || user.is_bot || typeof user.first_name !== 'string') return null;
    const name = [user.first_name,typeof user.last_name === 'string' ? user.last_name : ''].join(' ').trim().slice(0,128);
    return {
      id:String(user.id),
      name,
      username:typeof user.username === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(user.username) ? user.username : undefined,
      photo:typeof user.photo_url === 'string' && user.photo_url.startsWith('https://') && user.photo_url.length <= 2048 ? user.photo_url : undefined,
      language:typeof user.language_code === 'string' ? user.language_code.slice(0,16) : undefined,
    };
  } catch { return null; }
}

export async function sessionKey(secret: string) {
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function createSession(key: CryptoKey, botId: string, user: string, now = nowSeconds()) {
  const expires = now + sessionLifetime;
  const payload = encode(encoder.encode(JSON.stringify([user,expires])));
  const signature = await crypto.subtle.sign('HMAC',key,encoder.encode('iqup-telegram-v1:' + botId + ':' + payload));
  return {token:payload + '.' + encode(new Uint8Array(signature)),expires};
}
export async function verifySession(key: CryptoKey, botId: string, token: string, now = nowSeconds()): Promise<string | null> {
  if (token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload,signature] = parts;
  try {
    if (!await crypto.subtle.verify('HMAC',key,decode(signature),encoder.encode('iqup-telegram-v1:' + botId + ':' + payload))) return null;
    const [id,expires] = JSON.parse(decoder.decode(decode(payload)));
    if (typeof id === 'string' && /^\d+$/.test(id) && validId(Number(id)) && Number.isSafeInteger(expires) && expires > now) return id;
  } catch { /* Invalid session. */ }
  return null;
}
