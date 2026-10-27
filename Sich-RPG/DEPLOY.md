# Січ RPG — повне онлайн-розгортання (без обмеження функцій)

## Що вже готово

- **Повний рушій** з архіву: PvE, PvP, фракції, 5 міст, курені, предмети, інвентар, сюжет, випробування, каравани, чат, ринок, реєстрація.
- Статичний інтерфейс `public/` для GitHub Pages (працює в підкаталозі репозиторію).
- Серверний API `supabase/functions/sich-api/` із постійним спільним станом у PostgreSQL та захищеними сесіями.
- Для тестового Supabase-проєкту `zkhhmcsgdnufryyrcqwo` окрему таблицю вже створено; інші таблиці не зачіпалися.
- Синхронізація чистої логіки із Node-версії: `node scripts/sync-edge-engine.mjs`.
- 46 оригінальних тестів + інтеграційний тест Edge з двома гравцями.

## Автоматичне розгортання

### Windows

Розпакуйте ZIP і запустіть `deploy.ps1` у PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### macOS / Linux

```bash
bash deploy.sh
```

Потрібні лише встановлені `git`, `gh` (GitHub CLI) і `node`/`npx` (Node.js). Скрипт допоможе авторизуватися в офіційних GitHub і Supabase CLI, розгорне сервер і завантажить **весь** проєкт у новий публічний репозиторій `sich-rpg`. Якщо репозиторій вже існує — зупиниться, щоб не затерти файли.

GitHub Pages слід увімкнути в **Settings → Pages → Build and deployment → Source → GitHub Actions**. Публікацію робить `.github/workflows/pages.yml` без сторонніх build-кроків. Після завершення GitHub Actions URL буде `https://ВАШ_ЛОГІН.github.io/sich-rpg/`.

## Supabase сервер

API буде `https://zkhhmcsgdnufryyrcqwo.supabase.co/functions/v1/sich-api/api/state`.

**Важливо:** перед тим як сайт почне працювати для друзів, треба розгорнути Edge Function `sich-api`. Скрипти вище виконують це першочергово й не публікують сайт у разі помилки. Перевірка без авторизації через API:

```bash
curl -i -H "Origin: https://vitalikjukivskiy.github.io" \
  "https://zkhhmcsgdnufryyrcqwo.supabase.co/functions/v1/sich-api/api/state"
```

Очікується HTTP 200 із JSON стану світу та заголовком `X-Sich-Session`. HTTP 404 означає, що функцію ще не розгорнуто.

Якщо переносите проєкт на інший Supabase, виконайте `docs/supabase.sql` в SQL Editor, змініть URL у `public/config.js` та перелік дозволених origin у `supabase/functions/sich-api/index.ts`. Ключ `service_role` / секрети не можна додавати в репозиторій або клієнтський JS.

## Контроль якості

```bash
npm test
node --experimental-strip-types scripts/test-edge.mjs
```

Тест Edge запускається без доступу до бази й перевіряє створення незалежних персонажів, збереження світу, фракцію, реєстрацію, вхід та спільний чат. Перед випуском для великої аудиторії потрібні додаткове навантажувальне тестування й моніторинг квот Supabase.

## Примітки

GitHub Pages не вміє запускати Node.js на сервері, тому оригінальний `server.mjs` збережено для локальної гри, а онлайн-режим перенесено в Edge Functions. Браузер бачить тільки публічну адресу API, а доступ до Postgres залишається всередині серверної функції. Сесії передаються окремим заголовком і зберігаються в LocalStorage цього сайту; парольні хеші зберігаються на сервері. У разі особистої гри з великим числом користувачів бажано додати централізований rate limit та логування підозрілих входів.
