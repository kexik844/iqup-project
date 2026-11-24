import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';

const expectedBot = 'iqupp_bot';
const secretHeader = 'x-telegram-bot-api-secret-token';

async function readSecret(prompt) {
  const hidden = new Writable({write(_chunk,_encoding,done) { done(); }});
  const terminal = createInterface({input:stdin,output:hidden,terminal:true,historySize:0});
  stdout.write(prompt);
  terminal.on('SIGINT', () => {
    terminal.close();
    stdout.write('\n');
    process.exit(130);
  });
  try {
    return (await terminal.question('')).trim();
  } finally {
    terminal.close();
    stdout.write('\n');
  }
}

async function telegram(token, method, body) {
  let response;
  let data;
  try {
    response = await fetch('https://api.telegram.org/bot' + token + '/' + method,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body ?? {}),
      signal:AbortSignal.timeout(15000),
      redirect:'error',
    });
    data = await response.json();
  } catch {
    throw new Error('Не удалось связаться с Telegram (' + method + ').');
  }
  if (!response.ok || data?.ok !== true) throw new Error('Telegram отклонил запрос ' + method + ' (HTTP ' + response.status + '). Проверь токен и настройки бота.');
  return data.result;
}

async function main() {
  const args = process.argv.slice(2);
  let site;
  try {
    site = new URL(args[0]);
  } catch {
    throw new Error('Запуск: node scripts/set-telegram-webhook.mjs https://твой-домен.vercel.app');
  }
  if (site.protocol !== 'https:' || site.username || site.password || site.port ||
      site.pathname !== '/' || site.search || site.hash) {
    throw new Error('Укажи только HTTPS-адрес сайта, без пути, порта и параметров.');
  }
  const url = new URL('/api/telegram-webhook',site).href;

  if (!stdin.isTTY) throw new Error('Запусти скрипт в интерактивном терминале, например в PowerShell.');
  const secret = await readSecret('Вставь значение TELEGRAM_WEBHOOK_SECRET из Vercel и нажми Enter: ');
  if (!/^[a-zA-Z0-9_-]{32,256}$/.test(secret)) throw new Error('Нужны 32–256 символов из A–Z, a–z, 0–9, _ и -.');
  const probe = await fetch(url,{
    method:'POST',
    headers:{[secretHeader]:secret,'Content-Type':'application/json'},
    body:'{}',
    signal:AbortSignal.timeout(15000),
    redirect:'error',
  }).catch(() => {
    throw new Error('Адрес вебхука недоступен. Проверь публичный HTTPS-адрес из Vercel.');
  });
  if (!probe.ok || (await probe.json().catch(() => null))?.ok !== true) {
    throw new Error('Вебхук ещё не готов (HTTP ' + probe.status + '). Проверь, что Vercel собрал проект из исходников и получил секрет, затем повтори.');
  }

  const token = await readSecret('Вставь действующий токен @iqupp_bot из BotFather и нажми Enter: ');
  if (!/^\d{5,16}:[a-zA-Z0-9_-]{20,}$/.test(token)) throw new Error('Проверь формат токена BotFather.');
  const bot = await telegram(token,'getMe');
  if (bot?.username?.toLowerCase() !== expectedBot) throw new Error('Этот токен не принадлежит @' + expectedBot + '.');

  const previous = await telegram(token,'getWebhookInfo');
  if (previous?.url && previous.url !== url && !args.includes('--replace')) {
    throw new Error('У бота уже есть вебхук на другом адресе. Если ты хочешь перенести его на Vercel, повтори команду с флагом --replace.');
  }
  await telegram(token,'setWebhook',{url,secret_token:secret,allowed_updates:['message']});
  const active = await telegram(token,'getWebhookInfo');
  if (active?.url !== url) throw new Error('Telegram ещё не подтвердил новый адрес вебхука. Повтори настройку.');
  console.log('Вебхук настроен. Открой https://t.me/' + expectedBot + ' и отправь /start.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
