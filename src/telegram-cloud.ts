import { telegram } from './telegram';

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const telegramCloudConfigured = Boolean(projectUrl && publishableKey);

export type TelegramUser = {
  id:string;
  name:string;
  username?:string;
  photo?:string;
  language?:string;
};
export type TelegramSession = { user:TelegramUser; token:string; expires:number };
export class TelegramCloudError extends Error {
  constructor(readonly status:number) { super('Telegram cloud request failed'); }
}

export async function telegramRequest<T>(payload:Record<string,unknown>): Promise<T> {
  const response = await fetch(projectUrl + '/functions/v1/iqup-telegram',{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:publishableKey},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new TelegramCloudError(response.status);
  return response.json();
}
export function signInTelegram() {
  return telegramRequest<TelegramSession>({action:'login',initData:telegram()?.initData});
}
