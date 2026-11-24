# Приветствие @iqupp_bot на Vercel

В личном чате команда `/start` приветствует по имени. Команды `/app`, `/help` и обычный текст показывают, как открыть тренировки. Кнопка **Открыть IQUP** ведёт в уже настроенную Mini App.

## 1. Добавь обработчик в проект

Рядом с `package.json` должны быть `api/telegram-webhook.js` и `scripts/set-telegram-webhook.mjs`. Скопируй эти два файла в свой текущий проект или используй исходники из этого архива. На Vercel выбери корень исходного проекта с `package.json` и `api/`, чтобы Vercel собрал сайт и серверную функцию. Для Vite папка результата сборки — `dist`.

## 2. Добавь переменную и запусти новый деплой

В терминале с Node.js 22 или новее сгенерируй случайное значение.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Сохрани значение, оно понадобится на следующем шаге. В настройках проекта Vercel открой **Settings → Environment Variables**. Добавь `TELEGRAM_WEBHOOK_SECRET` как секрет для **Production**. После этого запусти новый production-деплой.

## 3. Подключи Telegram к деплою

В терминале из корня проекта выполни команду с публичным production-адресом своего IQUP.

```powershell
node scripts/set-telegram-webhook.mjs https://твой-домен.vercel.app
```

Терминал попросит вставить секрет Vercel, затем актуальный токен @iqupp_bot из BotFather. При вводе символов видно не будет. После каждой вставки нажми Enter. Токен нужен скрипту для регистрации вебхука в Telegram. В Vercel хранится только `TELEGRAM_WEBHOOK_SECRET`. Если токен уже попадал в чат, отзови его через @BotFather → `/revoke` и введи новый.

Скрипт проверит, что у функции правильный секрет и что токен принадлежит @iqupp_bot. Если у бота уже есть вебхук на другом адресе, добавь `--replace`, чтобы переключить бота на Vercel.

## 4. Проверь

Открой [чат с @iqupp_bot](https://t.me/iqupp_bot), отправь `/start` и нажми **Открыть IQUP** под сообщением. Это проверит доставку приветствия и запуск Mini App в Telegram.

[Telegram Bot API](https://core.telegram.org/bots/api#setwebhook) · [Vercel Functions](https://vercel.com/docs/functions) · [Переменные окружения Vercel](https://vercel.com/docs/environment-variables)
