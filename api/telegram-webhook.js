import { createHash, timingSafeEqual } from 'node:crypto';

const botUsername = 'iqupp_bot';
const miniApp = 'https://t.me/' + botUsername + '?startapp';
const secretHeader = 'x-telegram-bot-api-secret-token';
const validSecret = /^[a-zA-Z0-9_-]{32,256}$/;

function sameSecret(expected, received) {
  const hash = value => createHash('sha256').update(value).digest();
  return validSecret.test(received) && timingSafeEqual(hash(expected), hash(received));
}

function respond(body, status = 200) {
  return Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response(null, {status:405, headers:{Allow:'POST'}});
    }
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
    if (!validSecret.test(expected)) return respond({error:'not_configured'},503);
    if (!sameSecret(expected, request.headers.get(secretHeader) ?? '')) {
      return respond({error:'unauthorized'},401);
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return respond({error:'invalid_json'},400);
    }
    const message = update?.message;
    if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) ||
        message.chat.id <= 0 || message.from?.is_bot || typeof message.text !== 'string') {
      return respond({ok:true});
    }
    const [command] = message.text.trim().toLowerCase().split(/\s+/);
    if (!command) return respond({ok:true});
    const [action, mention] = command.split('@',2);
    if (action.startsWith('/') && mention && mention !== botUsername) return respond({ok:true});

    const start = action === '/start';
    const firstName = typeof message.from?.first_name === 'string'
      ? message.from.first_name.replace(/\s+/gu,' ').trim().slice(0,64)
      : '';
    const greeting = firstName ? 'Привет, ' + firstName + '!' : 'Привет!';
    return respond({
      method:'sendMessage',
      chat_id:message.chat.id,
      text:start
        ? greeting + ' Это IQUP — тренировки памяти, внимания, логики, реакции и устного счёта.\n\nНажми «Открыть IQUP» и выбери первое упражнение. Вход через Telegram автоматический.'
        : 'Нажми «Открыть IQUP», чтобы перейти к тренировкам.',
      reply_markup:{inline_keyboard:[[{text:'Открыть IQUP',url:miniApp}]]},
    });
  },
};
