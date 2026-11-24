type TelegramApp = {
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  viewportStableHeight?: number;
  safeAreaInset?: { top: number; bottom: number };
  onEvent?(type: string, listener: () => void): void;
  offEvent?(type: string, listener: () => void): void;
  BackButton?: { show(): void; hide(): void; onClick(handler: () => void): void; offClick(handler: () => void): void };
  HapticFeedback?: { impactOccurred(style: 'light'|'medium'): void; notificationOccurred(type: 'success'|'error'): void };
  openTelegramLink?(url: string): void;
};
declare global { interface Window { Telegram?: { WebApp?: TelegramApp } } }
export const telegram = () => window.Telegram?.WebApp;
const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/,'');
export const telegramAppUrl = botUsername && /^[a-zA-Z0-9_]+$/.test(botUsername) ? 'https://t.me/' + botUsername + '?startapp' : undefined;
export function initTelegram() {
  const app = telegram();
  if (!app?.initData) return;
  const updateViewport = () => {
    if (app.viewportStableHeight) document.documentElement.style.setProperty('--app-height',`${app.viewportStableHeight}px`);
    if (app.safeAreaInset) {
      document.documentElement.style.setProperty('--tg-safe-bottom',`${app.safeAreaInset.bottom}px`);
      document.documentElement.style.setProperty('--tg-safe-top',`${app.safeAreaInset.top}px`);
    }
  };
  updateViewport();
  app.onEvent?.('viewportChanged',updateViewport);
  app.onEvent?.('safeAreaChanged',updateViewport);
  app.ready();
  app.expand();
  return () => {
    app.offEvent?.('viewportChanged',updateViewport);
    app.offEvent?.('safeAreaChanged',updateViewport);
  };
}
export async function share(text: string, referral = false) {
  const url = new URL(telegramAppUrl ?? import.meta.env.BASE_URL,location.href);
  if (telegramAppUrl) {
    if (referral) url.searchParams.set('startapp','iqup');
  } else {
    url.hash = '#/home';
    if (referral) url.searchParams.set('ref','iqup');
  }
  const app = telegram();
  if (app?.initData && app.openTelegramLink) {
    app.openTelegramLink('https://t.me/share/url?' + new URLSearchParams({url:url.href,text}));
    return true;
  }
  try {
    if (navigator.share) await navigator.share({ text,url:url.href });
    else await navigator.clipboard.writeText(text + ' ' + url.href);
    return true;
  } catch { return false; }
}
export function feedback(success: boolean, sound: boolean, haptics: boolean) {
  if (haptics) telegram()?.HapticFeedback?.notificationOccurred(success ? 'success' : 'error');
  if (!sound) return;
  try {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = success ? 570 : 260;
    gain.gain.value = .03;
    tone.connect(gain);
    gain.connect(audio.destination);
    tone.onended = () => void audio.close();
    tone.start();
    tone.stop(audio.currentTime + .12);
  } catch { /* Audio is optional. */ }
}

export async function shareResultImage(game: string, result: string, record: string, mascot: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 660;
  const context = canvas.getContext('2d');
  if (!context) return share(`IQUP · ${game} · ${result}`);
  const gradient = context.createLinearGradient(0,0,1080,660);
  gradient.addColorStop(0,'#17172f');
  gradient.addColorStop(1,'#654fcf');
  context.fillStyle = gradient;
  context.fillRect(0,0,1080,660);
  const image = new Image();
  image.src = mascot;
  try {
    await image.decode();
    const scale = Math.min(420 / image.width,430 / image.height);
    context.drawImage(image,620,125,image.width*scale,image.height*scale);
  } catch { /* The text card is still usable. */ }
  context.fillStyle = '#c4b5ff';
  context.font = '800 56px system-ui';
  context.fillText('IQUP',70,112);
  context.fillStyle = 'white';
  context.font = '750 44px system-ui';
  context.fillText(game,70,235,555);
  context.font = '850 95px system-ui';
  context.fillText(result,70,365,555);
  if (record) {
    context.fillStyle = '#ffda88';
    context.font = '720 31px system-ui';
    context.fillText(record,72,450,520);
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,'image/png'));
  if (!blob) return share(`IQUP · ${game} · ${result}`);
  const file = new File([blob],'IQUP-result.png',{type:'image/png'});
  try {
    if (navigator.canShare?.({files:[file]}) && navigator.share) {
      await navigator.share({ files:[file], title:`IQUP · ${game}`, text:result });
      return true;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url),1000);
    return true;
  } catch { return false; }
}
