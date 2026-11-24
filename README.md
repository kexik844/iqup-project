# IQUP для Telegram

В Telegram IQUP автоматически использует имя, @username и фото, если Telegram их передаёт. Упражнения, XP, IQ Coins и история привязаны к Telegram ID. При открытии сайта в браузере доступен гостевой режим с локальным прогрессом.

Подключение приветствия и кнопки «Открыть IQUP» в личном чате с ботом описано в [TELEGRAM-BOT.md](TELEGRAM-BOT.md).

## 1. Подготовь Supabase

Открой свой Supabase-проект `hblgwhowhuwninktabky`. В **SQL Editor → New query** вставь файл `supabase/iqup_telegram_progress.sql` и нажми **Run**. Таблица для Telegram создаётся отдельно. Прогресс старых email-аккаунтов остаётся в `iqup_progress` и автоматически в Telegram-аккаунты не переносится.

В терминале в папке с этим README выполни команды. Для `npx` нужен установленный Node.js.

```powershell
npx supabase login
npx supabase link --project-ref hblgwhowhuwninktabky
npx supabase secrets set TELEGRAM_BOT_ID=9065894849
npx supabase functions deploy iqup-telegram --use-api --no-verify-jwt
```

`TELEGRAM_BOT_ID` — числовой ID именно @iqupp_bot. Функция проверяет подпись запуска Telegram и использует встроенный серверный ключ Supabase. Для этих команд не нужны токен бота, секретный ключ проекта или ручная регистрация игроков. `--no-verify-jwt` передаёт проверку пользователя функции, где применяется подпись Telegram.

## 2. Размести сайт

Загрузи **содержимое** папки `dist/` на выбранный статический хостинг. В корне опубликованного адреса должен открываться `index.html`. Нужен общедоступный HTTPS-адрес. Supabase URL, публичный ключ и @iqupp_bot уже включены в сборку. Настраивать **Authentication → URL Configuration** для входа в Telegram не нужно.

Если меняешь проект Supabase или бота, обнови публичные параметры в `.env.production` и пересобери сайт.

```powershell
npm ci
npm run build
```

## 3. Подключи @iqupp_bot

1. В [@BotFather](https://t.me/BotFather) открой `/mybots` → **@iqupp_bot** → **Bot Settings → Configure Mini App**. Включи **Main Mini App** и укажи HTTPS-адрес с шага 2.
2. Для кнопки в чате отправь @BotFather `/setmenubutton`, выбери @iqupp_bot, укажи тот же HTTPS-адрес и назови кнопку **Открыть IQUP**.
3. Открой [IQUP через Telegram](https://t.me/iqupp_bot?startapp). В профиле появятся сведения из Telegram. Пройди упражнение и открой Mini App ещё раз. В **Прогресс → История** должен быть этот результат.
4. Открой обычный HTTPS-адрес в браузере. В шапке должна быть надпись **Гость**. В разделе **Гость** кнопка **Открыть в Telegram** ведёт в бота.

Для Main Mini App и кнопки меню достаточно настройки через BotFather. Отдельный процесс бота для этих двух способов запуска не нужен.

## Разработка

```powershell
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Vite использует только значения `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` и `VITE_TELEGRAM_BOT_USERNAME`. Для локальной проверки Telegram можно скопировать `.env.example` в `.env.local` и указать публичные значения твоего проекта. В обычном браузере разработка работает в гостевом режиме.

[Telegram Mini Apps](https://core.telegram.org/bots/webapps) · [Supabase Edge Functions](https://supabase.com/docs/guides/functions/deploy)

## Рейтинг, обращения и админ-панель

Для уже установленного IQUP запусти `supabase/iqup_community.sql` в Supabase SQL Editor. Он добавляет рейтинг и поддержку поверх существующего прогресса. Затем из корня репозитория обнови Edge Function.

```powershell
npx supabase functions deploy iqup-telegram --project-ref hblgwhowhuwninktabky --use-api --no-verify-jwt
```

Вебхук Telegram-бота работает через прежний маршрут Vercel. Vercel собирает сайт из исходников командой `npm run build` и публикует `dist/` по настройкам `vercel.json`.

Чтобы открыть админ-панель, войди в IQUP через Telegram и скопируй свой числовой ID из раздела **Настройки → Telegram ID**. В Supabase SQL Editor замени `123456789` своим ID и выполни запрос.

```sql
insert into public.iqup_admins(telegram_id)
values (123456789)
on conflict do nothing;
```

После повторного открытия настроек появится кнопка **Админ-панель**. В панели видны сводка, обращения с ответами и статусами, поиск игроков, управление их видимостью в рейтинге и журнал действий. Для отзыва доступа удали запись со своим Telegram ID из `public.iqup_admins`.

Рейтинг выводит 100 игроков по суммарному XP из Supabase и место текущего игрока, даже если оно ниже первой сотни. Имя видно, только если игрок включил его показ. XP по-прежнему рассчитывает игровой клиент, администратор может скрыть запись из рейтинга.

Игроки отправляют обращения в разделе **Поддержка**. Ответы и статус отображаются там же. Старые локальные записи видны в профиле как черновики. В **Магазин → Инвентарь** можно применить уже купленную тему. Состояние темы сохраняется вместе с профилем.
