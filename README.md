# cure

Импорты файлов проекта используют `@/` от корня репозитория:
`@/src/i18n`, `@/locales/en/messages.po`. Алиас настроен в TypeScript и Rsbuild.

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

Русский — исходный язык. `/?lang=ru` и `/?lang=en` выбирают язык на сервере
и клиенте; без параметра используется русский. При навигации сохраняйте `lang`
через `search={(prev) => ({ ...prev })}`. Пример переключения есть на главной.

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
