import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, test } from 'node:test';
import webhook from '../api/telegram-webhook.js';

const secret = 'test-only-webhook-secret-for-local-requests';
const initialSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const address = 'https://example.test/api/telegram-webhook';
const chat = {id:42,type:'private'};
const user = {id:42,first_name:'Ранис',is_bot:false};
const update = text => ({update_id:16,message:{chat,from:user,text}});

before(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = secret;
});
after(() => {
  if (initialSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = initialSecret;
});

function send(body, token = secret) {
  return webhook.fetch(new globalThis.Request(address,{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':token},
    body:JSON.stringify(body),
  }));
}

test('greet by name and open the correct Mini App from /start', async () => {
  for (const command of ['/start','/start invite_code','/start@iqupp_bot']) {
    const response = await send(update(command));
    assert.equal(response.status,200);
    const body = await response.json();
    assert.equal(body.method,'sendMessage');
    assert.equal(body.chat_id,chat.id);
    assert.match(body.text,/^Привет, Ранис!/);
    assert.deepEqual(body.reply_markup.inline_keyboard,[[{
      text:'Открыть IQUP',url:'https://t.me/iqupp_bot?startapp',
    }]]);
  }
});
test('show a launch button from help and any ordinary text', async () => {
  for (const command of ['/help','/app','Привет','@iqupp_bot','test@example.com']) {
    const body = await (await send(update(command))).json();
    assert.equal(body.method,'sendMessage');
    assert.match(body.text,/перейти к тренировкам/);
  }
});
test('accept an authenticated setup probe and ignore groups, bots and non-text updates', async () => {
  for (const body of [
    {},
    {message:{...update('/start').message,chat:{id:-42,type:'group'}}},
    {message:{...update('/start').message,from:{is_bot:true}}},
    {message:{chat,from:user,photo:[{}]}},
    update('/start@other_bot'),
    update(' '),
  ]) {
    const response = await send(body);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{ok:true});
  }
});
test('reject unauthorized requests and unsupported methods', async () => {
  assert.equal((await send(update('/start'),'')).status,401);
  assert.equal((await send(update('/start'),'wrong-webhook-secret-for-local-requests')).status,401);
  const result = await webhook.fetch(new globalThis.Request(address));
  assert.equal(result.status,405);
  assert.equal(result.headers.get('allow'),'POST');
});
