# cure

Импорты файлов проекта используют `@/` от корня репозитория:
`@/src/i18n`, `@/locales/en/messages.po`. Алиас настроен в TypeScript и Rsbuild.

## Desktop и mobile

URL страниц общие, но сервер выбирает отдельное дерево React-компонентов
до SSR: `src/routes/-index.desktop.tsx` или `src/routes/-index.mobile.tsx`.
Выбор выполняется по `Sec-CH-UA-Mobile` и `User-Agent` запроса в корневом
loader через `getRequestDevice`; это не зависит от ширины окна или CSS media queries.
Телефоны и распознаваемые планшеты используют mobile, неизвестные клиенты — desktop.
Desktop-страница содержит две колонки; mobile-страница — отдельную последовательную
компоновку. Общая логика авторизации, переводов и TanStack DB используется повторно.
Все файлы страниц находятся прямо в `src/routes`, без вложенных папок.
Файлы `-index.desktop.tsx` и `-index.mobile.tsx` начинаются с `-`, чтобы
TanStack Router не создавал для них отдельные URL. Их выбирает `index.tsx`
по `device` из loader корневого маршрута. Для новых страниц используйте
такое же соглашение `-<страница>.desktop.tsx` / `-<страница>.mobile.tsx`.
Вложенные URL задавайте точками в имени: `auth.error.tsx`, `api.auth.$.ts`.

Сервер сериализует выбранный `device` вместе с данными маршрута и записывает его
в `data-device` документа. Гидрация и клиентские переходы сохраняют этот выбор;
изменение размера окна не переключает версию. Динамический HTML получает
`Vary: User-Agent, Sec-CH-UA-Mobile` и `Cache-Control: private, no-store`.
API и OAuth callback сохраняют общие URL и не перенаправляются по устройству.

PWA-оболочка не содержит выбранной версии страницы. При запуске без сети
клиент определяет устройство через `navigator.userAgentData.mobile` и
`navigator.userAgent`, затем рендерит подходящую страницу. Обе версии входят
в precache сборки. Ключи локального счётчика и данные TanStack DB общие для
версий на одном устройстве и не меняются при выборе интерфейса.

Определение класса устройства по заголовкам эвристическое: подменённый User-Agent
и iPad в режиме desktop могут определяться как компьютер. Размер viewport серверу
при первом запросе неизвестен; выбор версии не является проверкой прав доступа.

Проверки без запуска сервера: `npm test` и `npm run test:vercel`.
`npm run test:pwa` дополнительно проверяет обе версии после офлайн-перезапуска
браузера; эту команду запускает пользователь согласно `AGENTS.md`.

## PWA

Приложение можно установить из браузера. В Chromium кнопка «Установить приложение»
появляется, когда браузер разрешает установку. На iPhone/iPad используйте
Safari → Поделиться → На экран «Домой». В production требуется HTTPS;
на компьютере для проверки подходит `localhost`.

```sh
npm run build
npm start
```

Откройте `http://localhost:3000`, дождитесь сообщения о готовности к запуску
без интернета, затем отключите сеть и перезагрузите страницу.
Service Worker включается только в production-сборке.

`public/manifest.webmanifest` содержит метаданные установки и иконки.
Это браузерный JSON-ресурс; логика сборки остаётся в TypeScript.
Иконки находятся в `public/icons`; после изменения `icon.svg` выполните
`npm run icons` для генерации PNG, включая maskable и Apple touch icon.

Serwist предварительно кеширует статические ресурсы и неперсональную оболочку
`/_shell.html`, которую генерирует TanStack Start. Онлайн-страницы сохраняют SSR.
При недоступной сети оболочка запускает тот же маршрутизатор на клиенте,
без ожидания серверной функции проверки сессии. HTML оболочки рендерится
на клиенте, обычные SSR-ответы гидратируются. Это позволяет использовать одну
оболочку для разных маршрутов и языков без ошибок гидратации.

Ответы `/api/auth/*`, `/_serverFn/*`, Convex API и персонализированные SSR-страницы
не сохраняются в Service Worker. Без сети новый вход через Google недоступен;
потеря сети не вызывает автоматический выход или удаление локальных данных.
Обновление Service Worker ожидает нажатия «Обновить приложение», затем
страница перезагружается. Данные TanStack DB при обновлении не очищаются.

Демонстрационный счётчик на главной хранится локально через TanStack DB
(`localStorageCollectionOptions`) и переживает закрытие браузера.
Это публичные данные этого устройства, которые не отправляются в Convex.
Пользовательских офлайн-коллекций и бизнес-операций для синхронизации пока нет:
для них нужно отдельно подключить Convex collections, постоянное хранилище
и `@tanstack/offline-transactions` согласно скиллу `cure-offline-first`.

```sh
npx playwright install chromium # Один раз перед браузерными тестами
npm run test:pwa                 # Production-сборка и браузерные проверки
```

Тесты проверяют SSR, manifest и иконки, офлайн-перезагрузку и запуск после
полного перезапуска браузера с тем же профилем, сохранение локального счётчика,
открытие другого маршрута без сети и отсутствие auth/API-ответов в кеше.
Они также входят в `npm run check` и выполняются перед коммитом.
На новой машине перед первой проверкой установите Chromium указанной выше командой.

## Вход через Google

Авторизация использует Better Auth и компонент `@convex-dev/better-auth`.
Сессии и аккаунты хранятся в Convex. TanStack Start проксирует `/api/auth/*`
в Convex, поэтому cookies принадлежат домену приложения и доступны при SSR.
На главной есть вход через Google, профиль и выход; `/auth/error` показывает
ошибку или отмену входа. Текущий URL и выбранный язык сохраняются при входе.

### Настройка Google и Convex

#### Где хранятся переменные окружения

У проекта два отдельных окружения. Локальный `.env.local` читают Rsbuild
и сервер TanStack Start. Код `convex/auth.ts`, включая Better Auth, выполняется
на backend Convex и читает `process.env` выбранного deployment.
Локальный файл автоматически в Convex не передаётся.

| Переменные                                           | Где задавать                              | Для чего                                                  |
| ---------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `CONVEX_DEPLOYMENT`, `CONVEX_URL`, `CONVEX_SITE_URL` | Локальный `.env.local`                    | Выбор deployment для CLI и адреса Convex для приложения   |
| `BETTER_AUTH_SECRET`                                 | Environment Variables в Convex deployment | Секрет Better Auth                                        |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | Environment Variables в Convex deployment | Серверная авторизация через Google                        |
| `SITE_URL`                                           | Environment Variables в Convex deployment | Адрес приложения для OAuth callback и разрешённого origin |

Переменные в Convex — это также env, только окружение удалённого backend.
Добавление Google-реквизитов исключительно в `.env.local` не настроит
Better Auth в Convex: их нужно установить через `npx convex env set`
или Dashboard → Settings → Environment Variables.
Для dev и production значения задаются отдельно. Серверные секреты
не включайте в публичные переменные Rsbuild, клиентский бандл или Git.

#### Порядок настройки

1. В [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   настройте OAuth consent screen, затем создайте OAuth Client типа
   **Web application**. Если приложение в режиме Testing, добавьте свой аккаунт
   в Test users.
2. Добавьте **Authorized redirect URI**:
   `http://localhost:3000/api/auth/callback/google`.
   Это адрес приложения, а не `convex.cloud` или `convex.site`.
3. Убедитесь, что `.env.local` содержит значения вашего dev deployment:

   ```dotenv
   CONVEX_DEPLOYMENT=dev:your-deployment
   CONVEX_URL=https://your-deployment.convex.cloud
   CONVEX_SITE_URL=https://your-deployment.convex.site
   ```

4. Установите переменные **в Convex deployment**. GOOGLE_CLIENT_ID и
   GOOGLE_CLIENT_SECRET возьмите из созданного OAuth Client. Секрет Better Auth
   сгенерируйте один раз и сохраняйте между запусками:

   ```sh
   npx convex env set SITE_URL http://localhost:3000
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   npx convex env set GOOGLE_CLIENT_ID '<Google Client ID>'
   npx convex env set GOOGLE_CLIENT_SECRET '<Google Client Secret>'
   ```

   Секреты не нужно добавлять в `source.define`, публичные переменные Rsbuild
   или коммитить в репозиторий. `.env.example` содержит только шаблон.

5. Запустите `npx convex dev` и `npm run dev` (или задачу VS Code
   «Запустить всё»). Откройте `http://localhost:3000` и нажмите «Войти через Google».

Для production установите соответствующие переменные в production deployment,
задайте `SITE_URL=https://ваш-домен` и зарегистрируйте в Google callback
`https://ваш-домен/api/auth/callback/google`.
В окружении сервера TanStack Start должны быть production `CONVEX_URL`
и `CONVEX_SITE_URL`; после смены этих URL пересоберите приложение.

### Доступ к пользователю

`convex/auth.ts` экспортирует `authComponent` и публичный запрос
`api.auth.getCurrentUser`, возвращающий только поля профиля либо `null`.
Для защищённых функций вызывайте `await authComponent.getAuthUser(ctx)`
и проверяйте принадлежность запрашиваемых данных этому пользователю.
Скрытие кнопки или маршрута на клиенте не заменяет проверку в Convex.
После выхода отменяются запросы и очищается кеш TanStack Query.

Серверные функции и loaders могут использовать `fetchAuthQuery`,
`fetchAuthMutation` и `fetchAuthAction` из `@/src/lib/auth-server`.
Этот модуль помечен `server-only`; клиентские компоненты используют
`authClient` из `@/src/lib/auth-client`.

Документация: [Convex + Better Auth / TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start),
[Google provider](https://better-auth.com/docs/authentication/google).

## Развёртывание на Vercel

`vercel.ts` подключает Rsbuild-сборку к Vercel: файлы `dist/client`
публикуются как статика, а остальные запросы передаются в `api/index.ts`.
Эта Node.js Function вызывает `fetch` из `dist/server/index.js`;
все серверные чанки включены через `includeFiles`.
Так сохраняются SSR, server functions и `/api/auth/*`, включая Google callback.
Публикации одного `dist/client` недостаточно: обычного `index.html` в нём нет.

В настройках проекта Vercel используйте **Framework Preset: Other**.
Build Command `npm run build` и Output Directory `dist/client` заданы в конфиге;
удалите противоречащие им ручные overrides в Dashboard. Root Directory — корень
репозитория. Настройки хостинга хранятся в TypeScript-конфиге `vercel.ts`.

В **Settings → Environment Variables** добавьте для **Production** адреса
production deployment Convex; для **Preview** задайте адреса нужного тестового
deployment отдельно:

```dotenv
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site
```

Локальный `.env.local` автоматически на Vercel не переносится. Эти URL нужны
уже во время сборки. Google-реквизиты, `BETTER_AUTH_SECRET` и `SITE_URL` задаются
в Convex deployment, как описано в разделе авторизации. Для текущего домена
`SITE_URL=https://cure-avx3.vercel.app`, а Google Authorized redirect URI —
`https://cure-avx3.vercel.app/api/auth/callback/google`.

Статические файлы, manifest, иконки и `/_shell.html` обслуживаются раньше
SSR-маршрута. `sw.js` перепроверяется без долгого HTTP-кеширования,
а динамические ответы получают `Cache-Control: private, no-store`.
Авторизация и персонализированный HTML не подменяются общей PWA-оболочкой.

Проверка Vercel-обработчика без запуска сервера: `npm run test:vercel`.
Она собирает проект и проверяет неизменяемые заголовки ответа `fetch`,
передачу OAuth redirect и нескольких `Set-Cookie`, сохранение потока ответа.

После публикации изменений и настройки env выполните **Redeploy**.
Проверьте главную, прямой переход на `/auth/error`,
`/manifest.webmanifest`, `/sw.js`, вход Google и офлайн-перезагрузку после
подготовки Service Worker. Агент не запускает серверы и браузер для этих проверок.

Документация: [TanStack Start / Rsbuild hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#rsbuild),
[Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js),
[TypeScript-конфиг Vercel](https://vercel.com/docs/project-configuration/vercel-ts).

## AI: ГигаЧат по умолчанию и пользовательские ключи

По умолчанию выбран **ГигаЧат**. `src/server/gigachat.ts` вызывает официальный
SDK `gigachat` напрямую (`GigaChat.chat`). SDK управляет OAuth, access token
и повторной авторизацией. ГигаЧат не проходит через адаптер TanStack AI.
Ключ приложения задаёт администратор в окружении сервера TanStack Start:
локально `.env.local`, на Vercel Settings → Environment Variables.

```dotenv
GIGACHAT_CREDENTIALS=<Authorization Key без префикса Basic>
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_MODEL=GigaChat
```

Для бизнес-аккаунта задайте `GIGACHAT_API_B2B` или `GIGACHAT_API_CORP`.
При необходимости задайте `GIGACHAT_CA_CERT` с PEM bundle доверенных CA
из официальной инструкции: он добавится к системным CA через Node HTTPS Agent.
Проверка TLS остаётся включённой. Серверный ключ не нужен пользователю и
не попадает в браузер. Конфигурация ГигаЧат не хранится в Convex.
После смены env на Vercel выполните Redeploy. Локальный production runtime
должен прочитать `.env.local`:

```sh
npm run build
node --env-file=.env.local node_modules/srvx/bin/srvx.mjs --prod -s ../client dist/server/index.js
```

Это команды для пользователя; агент не запускает серверы согласно `AGENTS.md`.

После входа на главной доступны **Настройки AI**: провайдер, модель, ввод/удаление
ключа и кнопка «Проверить подключение». Проверка отправляет короткий запрос
`Reply with OK.` и расходует лимит выбранного провайдера; автоматически не запускается.

**TanStack AI используется для BYOK** (Bring Your Own Key):

- OpenAI — OpenAI-compatible adapter;
- Anthropic и Google Gemini — отдельные нативные адаптеры TanStack AI;
- OpenRouter, DeepSeek, Groq — OpenAI-compatible adapter;
- другие сервисы с OpenAI Chat Completions API — пользовательский endpoint.

Модель вводит пользователь. Для нативных Anthropic/Gemini доступны модели,
описанные метаданными установленного адаптера. Другие протоколы требуют
подключения соответствующего адаптера: один API-ключ не делает любой сервис
OpenAI-совместимым.

Форма использует `defineByok`, `memoryStorage`, `useByok`, `byok.update/clear/headers`.
Ключи находятся только в памяти текущей вкладки и передаются в HTTPS-запросе
через стандартный `x-byok-<provider>` заголовок. После перезагрузки нужно ввести
ключ снова. При выходе и смене пользователя keyring очищается; пользовательские
адаптеры и ключи не кешируются на сервере. `getByokKey` читает только ключ
пользователя, без подстановки общих ключей приложения из env.

Выбранный провайдер, модель и адрес API сохраняются как **локальные настройки
устройства** через TanStack DB (`cure.ai-preferences.v1.<userId>`), отдельно
для каждого аккаунта. Ключи не записываются в TanStack DB, localStorage,
Convex, очередь операций или Service Worker. Синхронизация этих локальных
настроек между устройствами не предусмотрена.

Для собственного endpoint администратор задаёт `AI_ALLOWED_BASE_URLS`:

```dotenv
AI_ALLOWED_BASE_URLS=https://my-gateway.example/v1,https://another-gateway.example/api/v1
```

Затем пользователь выбирает OpenAI-compatible API, вводит один из разрешённых
адресов, модель и свой ключ. Список содержит полные базовые HTTPS URL;
неизвестные адреса, URL с реквизитами/query/hash и перенаправления запрещены,
чтобы сервер приложения не становился произвольным прокси во внутреннюю сеть.

Обе ветки обслуживает защищённый `POST /api/ai/chat` в плоском файле
`src/routes/api.ai.chat.ts`. Он проверяет origin и пользователя Better Auth
через Convex, принимает текстовую историю и возвращает JSON `{ text, provider }`.
Пример запроса по умолчанию:

```json
{ "messages": [{ "role": "user", "content": "Привет!" }] }
```

Для BYOK добавьте `provider`, `model` и заголовки из `byok.headers(provider)`;
для `custom` также `baseURL`. Пример тела:

```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "messages": [{ "role": "user", "content": "Привет!" }]
}
```

Поддерживается текст: до 32 сообщений, до 8000 символов в сообщении,
до 64000 символов в теле. Максимум генерации — 1024 токена. UI подключения
не добавляет историю разговоров; для будущего чата история и черновики должны
храниться через TanStack DB с изоляцией по пользователю.

Ошибки возвращаются безопасными кодами без реквизитов провайдера. Ответы
имеют `Cache-Control: private, no-store`, Service Worker исключает API.
Генерация требует сети. Без интернета кнопка проверки недоступна; запросы
не ставятся в очередь и не повторяются автоматически после восстановления сети.
Настройки можно менять локально в открытой сессии. Доступ к настройкам после
холодного офлайн-запуска зависит от восстановления подтверждённой пользовательской
сессии; отдельного механизма офлайн-идентичности пока нет.

`npm test` проверяет вызов официального SDK, ключи и их изоляцию, выбор
TanStack-адаптеров, разрешённые endpoints, авторизацию и безопасные ошибки.
Реальные обращения требуют действующих ключей и настроенного Convex.

Документация: [официальный SDK ГигаЧат](https://github.com/ai-forever/gigachat-js),
[TanStack AI BYOK](https://tanstack.com/ai/latest/docs/advanced/byok),
[OpenAI-compatible adapter](https://tanstack.com/ai/latest/docs/adapters/openai-compatible).

## Форматирование и проверки

Конфиги инструментов находятся в TypeScript-файлах: `rsbuild.config.ts`,
`rslint.config.ts`, `lingui.config.ts`, `oxfmt.config.ts`, `postcss.config.ts`,
`commitlint.config.ts` и `lint-staged.config.ts`.
`package.json`, `tsconfig.json`, `convex/tsconfig.json` и `.vscode/*.json`
сохраняют обязательный для соответствующих инструментов формат JSON.

Oxfmt форматирует код и сортирует импорты: встроенные модули, зависимости,
импорты проекта через `@/`, относительные импорты, стили. Порядок импортов
с побочными эффектами сохраняется. Сгенерированные файлы исключены.
Стиль: 2 пробела, двойные кавычки, точки с запятой, ширина строки 100 символов.

Для форматирования при сохранении установите рекомендованное расширение **Oxc**
в VS Code. Настройки редактора находятся в `.vscode/settings.json`.

```sh
npm run fmt         # Форматирование и сортировка импортов
npm run fmt:check   # Проверка без изменения файлов
npm run lint       # Rslint
npm run lint:fix   # Исправления Rslint
npm run typecheck  # TypeScript
npm test           # Однократный запуск тестов
npm run test:watch # Тесты в режиме наблюдения
npm run check      # Все проверки, включая сборку и компиляцию переводов
```

Перед коммитом Husky запускает `lint-staged`: форматирует подготовленные файлы
и добавляет исправления в индекс, сохраняя неподготовленные изменения.
Затем запускается `npm run check`: форматирование, линтер, TypeScript, тесты,
сборка с извлечением переводов и строгая компиляция каталогов Lingui.
При ошибке коммит останавливается. Тесты авторизации проверяют анонимную
сессию, защиту от чужого origin и отклонение внешнего callback URL.

Хук `commit-msg` проверяет Conventional Commits через commitlint, например:
`feat(i18n): add language switcher`. Допустимые типы перечислены в
`commitlint.config.ts`, максимальная длина заголовка — 100 символов.
После `npm install` скрипт `prepare` автоматически подключает хуки.

## Переводы (Lingui)

Русский — исходный язык. Язык интерфейса определяется на сервере из запроса:
сначала поддерживаемое значение cookie `cure.locale` (ручной выбор пользователя),
затем заголовок `Accept-Language` с учётом весов `q` и регионов (`en-US` → `en`,
`ru-RU` → `ru`). Если подходящего языка нет, используется русский.
Для согласования языка применяется `negotiator`. Query-параметры язык не задают.

Переключатель на главной сохраняет `cure.locale` на год с `Path=/`, `SameSite=Lax`
и `Secure` на HTTPS и обновляет loader без смены URL. Cookie не содержит секретов;
она доступна клиенту для офлайн-переключения. Сервер учитывает её при следующих
запросах, в том числе после OAuth callback. Ссылки не должны добавлять `lang` в URL.
SSR выставляет `Content-Language`, `Vary: Accept-Language, Cookie` (в дополнение
к сигналам устройства) и `Cache-Control: private, no-store`.

Язык из SSR loader передаётся клиенту для гидрации. Последний язык сохраняется
в `localStorage` под ключом `cure.last-locale`. Общая PWA-оболочка при офлайн-запуске
выбирает язык из cookie, затем сохранённого значения, затем `navigator.languages`.
При недоступном хранилище остаётся определение по cookie/браузеру; локальные данные
TanStack DB не очищаются при переключении языка.

В компонентах используйте макрос из React-контекста:

```tsx
import { useLingui } from "@lingui/react/macro";

function Greeting() {
  const { t } = useLingui();
  return <h1>{t`Привет, мир!`}</h1>;
}
```

Для текста с разметкой используйте `Trans` из `@lingui/react/macro`.
ID генерируются автоматически. После добавления или изменения текста:

```sh
npm run i18n:extract
```

Заполните переводы в `locales/en/messages.po`. Каталог русского языка
заполняется исходными строками. Rsbuild компилирует `.po` через `@lingui/loader`
и подхватывает изменения каталогов при разработке. Извлечение также запускается
перед `npm run dev` и `npm run build`. Для отдельной компиляции каталогов:

```sh
npm run i18n:compile
```

При SSR экземпляр Lingui создаётся для каждого дерева приложения, а язык берётся
из данных корневого loader, которые TanStack Start передаёт клиенту. Общего
изменяемого экземпляра `i18n` на сервере нет. Не импортируйте глобальный `t`
из `@lingui/core/macro` для перевода внутри React-компонентов.
