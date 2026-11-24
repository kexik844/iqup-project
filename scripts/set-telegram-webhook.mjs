import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { platform, stdin, stdout } from 'node:process';

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

function networkHint(method, error) {
  const code = error?.cause?.code;
  if (['ENOTFOUND','EAI_AGAIN'].includes(code)) return method + ': не удалось разрешить api.telegram.org через DNS.';
  if (error?.name === 'TimeoutError' || ['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
    return method + ': Telegram API не ответил за 15 секунд.';
  }
  if (['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','CERT_HAS_EXPIRED'].includes(code)) {
    return method + ': Node.js не смог проверить сертификат Telegram API. Попробуй запустить скрипт с флагом --curl.';
  }
  return method + ': Node.js не смог открыть соединение с api.telegram.org. Попробуй запустить скрипт с флагом --curl.';
}

async function viaNode(url, payload, method) {
  try {
    const response = await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:payload,
      signal:AbortSignal.timeout(15000),
      redirect:'manual',
    });
    return {status:response.status,text:await response.text()};
  } catch (error) {
    throw new Error(networkHint(method,error));
  }
}

function viaCurl(url, payload, method) {
  return new Promise((resolve,reject) => {
    // Send the URL and JSON through stdin so the bot token never appears in the curl arguments.
    const curl = spawn(platform === 'win32' ? 'curl.exe' : 'curl',[
      '--disable','--config','-','--proto','=https','--silent','--max-time','15',
      '--request','POST','--header','Content-Type: application/json','--write-out','\n%{http_code}',
    ],{stdio:['pipe','pipe','ignore'],windowsHide:true});
    let output = '';
    curl.stdout.setEncoding('utf8');
    curl.stdout.on('data',chunk => { output += chunk; });
    curl.stdin.on('error',() => {});
    curl.on('error',() => reject(new Error('Не удалось запустить curl. Проверь команду curl.exe --version в PowerShell.')));
    curl.on('close',code => {
      const separator = output.lastIndexOf('\n');
      if (code !== 0 || separator < 0) {
        reject(new Error(method + ': curl не получил ответ от api.telegram.org (код ' + code + '). Попробуй другую сеть или системный VPN.'));
        return;
      }
      resolve({status:Number(output.slice(separator+1)),text:output.slice(0,separator)});
    });
    curl.stdin.end('url = ' + JSON.stringify(url) + '\ndata = ' + JSON.stringify(payload) + '\n');
  });
}

async function telegram(transport, token, method, body) {
  const url = 'https://api.telegram.org/bot' + token + '/' + method;
  const {status,text} = await transport(url,JSON.stringify(body ?? {}),method);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(method + ': ожидался JSON от Telegram, получен другой ответ (HTTP ' + status + '). Проверь доступ к api.telegram.org из этой сети.');
  }
  if (status === 401 || status === 404) throw new Error(method + ': Telegram отклонил токен (HTTP ' + status + '). Проверь актуальный токен в BotFather.');
  if (status < 200 || status >= 300 || data?.ok !== true) {
    throw new Error('Telegram отклонил запрос ' + method + ' (HTTP ' + status + ').');
  }
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
  const transport = args.includes('--curl') ? viaCurl : viaNode;

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
  const bot = await telegram(transport,token,'getMe');
  if (bot?.username?.toLowerCase() !== expectedBot) throw new Error('Этот токен не принадлежит @' + expectedBot + '.');

  const previous = await telegram(transport,token,'getWebhookInfo');
  if (previous?.url && previous.url !== url && !args.includes('--replace')) {
    throw new Error('У бота уже есть вебхук на другом адресе. Если ты хочешь перенести его на Vercel, повтори команду с флагом --replace.');
  }
  await telegram(transport,token,'setWebhook',{url,secret_token:secret,allowed_updates:['message']});
  const active = await telegram(transport,token,'getWebhookInfo');
  if (active?.url !== url) throw new Error('Telegram ещё не подтвердил новый адрес вебхука. Повтори настройку.');
  console.log('Вебхук настроен. Открой https://t.me/' + expectedBot + ' и отправь /start.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
