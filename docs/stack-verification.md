# CURE: проверка технологического стека

Дата проверки: **28 октября 2026 года**.

Это документальная проверка официальной документации, опубликованных пакетов и исходников.
Зависимости не устанавливались; приложение не создавалось; компиляция, SSR и тесты не запускались.
«Подтверждено» ниже означает наличие документированного API, а не успешную сборку всей связки CURE.

## Исходные условия и статус решений

- Репозиторий намеренно пустой; существующей демоверсии и кода для миграции нет.
- **Один файл на маршрут**, все файлы маршрутов находятся в плоской директории.
- Весь UI страницы остаётся в её файле; собственные переиспользуемые UI-компоненты не выделяются.
- Серверная логика, схемы, политики доступа, клиенты данных и переводы допускают отдельные модули.
- Mantine используется со стандартными компонентами и темами, без собственных стилей и переопределений темы.
- Десктопные `/d/...` и мобильные `/m/...` маршруты имеют отдельные UI/UX; выбор делает сервер.
- Авторизация через `@convex-dev/auth` остаётся исходным пожеланием; Better Auth — предложенная альтернатива, не согласованная замена.
- Перед разработкой нужен короткий технический этап проверки интеграций — далее «spike».

## Матрица совместимости

| Часть стека | Документально подтверждено | Что проверить в spike | Источник |
| --- | --- | --- | --- |
| TanStack Start + Rsbuild 2 | Официальный адаптер `@tanstack/react-start/plugin/rsbuild`; сборка на Rspack | Dev, production build, запуск сервера, SSR, server functions | [Start + Rsbuild](https://tanstack.com/blog/start-adds-rsbuild-support), [сборка](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) |
| Плоские файловые маршруты | Start использует генерацию дерева файловых маршрутов; точечные имена поддерживает Router | Прямой вход, параметры, layouts, 404 и lazy chunks обеих веток | [Start routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing), [имена файлов](https://tanstack.com/router/latest/docs/routing/file-naming-conventions) |
| Mantine + SSR | Официальный гайд Start: provider, стили, color scheme script | Подключение CSS и порядок стилей в Rsbuild, отсутствие мерцания и ошибок hydration | [Mantine + Start](https://mantine.dev/guides/tanstack-start/) |
| `@gratise/i18n` | Опубликован `0.1.0`; SSR, ICU, `createI18n`, `I18nProvider`, `T` | Изоляция запросов, передача locale/catalog, сборка CLI и клиента | [npm](https://www.npmjs.com/package/@gratise/i18n), [metadata](https://registry.npmjs.org/@gratise%2fi18n/latest) |
| Convex + TanStack Query | Официальная интеграция `@convex-dev/react-query` и реактивные обновления | Auth при SSR, подписки, очистка кэша, восстановление соединения | [Convex Query](https://docs.convex.dev/client/tanstack/tanstack-query) |
| Query + TanStack DB | `queryCollectionOptions` принимает QueryClient, queryKey, queryFn и getKey | Явный мост к Convex Query и согласование подписок, optimistic mutations, rollback | [Query Collection](https://tanstack.com/db/latest/docs/collections/query-collection) |
| Локальные данные DB | Есть отдельные механизмы persistence и offline transactions | Хранение после reload, очистка по пользователю, повторная отправка и конфликты | [установка DB](https://tanstack.com/db/latest/docs/installation), [offline transactions](https://tanstack.com/db/latest/docs/guides/offline-transactions) |
| `@convex-dev/auth` | Библиотека обозначена beta; есть password, OTP и OAuth | Официальная Start SSR-интеграция и встроенная MFA в проверенных материалах не подтверждены | [Convex Auth](https://labs.convex.dev/auth), [setup](https://labs.convex.dev/auth/setup) |
| Convex + Better Auth | Официальный Start SSR adapter; Two Factor входит в поддерживаемые плагины | Rsbuild externalization, cookie/session lifecycle, MFA и recovery | [Start guide](https://labs.convex.dev/better-auth/framework-guides/tanstack-start), [плагины](https://labs.convex.dev/better-auth/supported-plugins) |
| Better Auth Organization | Расширения схемы подключаются через Local Install; Organization не в списке готовых поддерживаемых плагинов | Локальная схема, приглашения, membership, индексы и обновления | [Local Install](https://labs.convex.dev/better-auth/features/local-install), [Organization](https://www.better-auth.com/docs/plugins/organization) |
| Rstest + Convex | `convex-test` принимает `convexTest(schema, modules)`; официальный гайд использует Vitest | Совместимость Rstest с module map, окружением и timers пока не подтверждена | [convex-test](https://docs.convex.dev/testing/convex-test), [Rstest](https://rstest.rs/) |
| TanStack AI 1.0 | Основные API выпущены как stable; harness остаётся experimental | Потоковый ответ, отмена, tool validation и ошибки выбранного провайдера | [релиз 1.0](https://tanstack.com/blog/tanstack-ai-1-0) |
| WebMCP | Экспериментальная регистрация клиентских tools; нет обязательной зависимости от поддержки браузера | Unsupported browser, SSR, secure context, lifecycle и серверные права | [TanStack WebMCP](https://tanstack.com/ai/latest/docs/tools/webmcp), [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp) |

## Базовые версии и сборка

Кандидаты для первого spike: **Node.js 24, pnpm 10, React 19, Rsbuild 2**, актуальная стабильная ветка TanStack Start.
Это базовая совместимая линия, а не зафиксированный и проверенный набор patch-версий.
`@gratise/i18n@0.1.0` требует React 19+, а его CLI — Node.js 24+; metadata также указывает pnpm 10+.
Node.js 24 относится к инструментам проекта и SSR-хосту; версию runtime Convex Node actions проверять отдельно.

- Использовать официальный Start Rsbuild plugin совместно с `@rsbuild/plugin-react`.
- Не добавлять Vite параллельно и не переносить Vite-specific параметры в Rsbuild без проверки.
- После успешного spike закрепить точные совместимые версии и lockfile; CI устанавливает зависимости без изменения lockfile.
- Проверить импорт клиентского и серверного кода: секреты, auth helpers и server functions не попадают в browser bundle.
- Rstest остаётся целевым test runner. Линтер и formatter закрепить совместимыми версиями в том же этапе.
- GitHub Actions и нативные Git hooks запускают одни и те же команды проверок; CI остаётся обязательной проверкой.

## Маршруты, устройства и SSR

Уточнение пользователя снимает конфликт с файловой маршрутизацией Start: речь об одном файле **на** маршрут.
Примеры плоских имён: `d.studies.tsx`, `d.studies.$studyId.tsx`, `m.studies.tsx`, `m.studies.$studyId.tsx`.
Точечная запись описывает URL и вложенность, но не создаёт вложенные директории.
Корневой shell и route layouts допустимы как маршруты; UI страниц не дробится на собственные компоненты.

- Нейтральный вход направляет запрос в `/m` или `/d` до отправки HTML.
- Кандидат порядка выбора: явная cookie пользователя → mobile Client Hint → User-Agent → desktop fallback.
- Планшет по умолчанию использует desktop; пользователь может явно переключить вариант.
- Переключатель сохраняет сущность и query-параметры и выполняет полную навигацию к парному маршруту.
- Fragment не передаётся серверу: при необходимости его сохраняет клиентская часть переключателя.
- Внутренние ссылки остаются в текущей ветке; изменение ширины окна не меняет ветку во время hydration.
- Прямые `/m/...` и `/d/...` ссылки не должны вызывать цикл автоматических перенаправлений.
- Оба варианта используют одинаковые серверные политики доступа и бизнес-операции.
- Не применять CSS breakpoints, `useMediaQuery` или responsive props для выбора мобильной композиции.
- Проверить согласованный fallback без Client Hints и ошибочную классификацию User-Agent.
- Персонализированный SSR не кэшируется публично; политика кэша должна учитывать auth, locale и вариант интерфейса.

Start предоставляет [request middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware).
Детектор устройства и правила переключения — архитектурное решение CURE, а не готовая гарантия фреймворка.
[Рекомендации hydration](https://tanstack.com/start/latest/docs/framework/react/guide/hydration-errors) требуют одинаковых исходных значений на сервере и клиенте.

## Mantine и локализация

- В SSR shell подключить `MantineProvider`, `ColorSchemeScript`, `mantineHtmlProps` и стили используемых пакетов.
- Использовать стандартные light/dark темы; не добавлять `theme` overrides, custom CSS или обёртки над UI.
- В Mantine guide показан импорт CSS через `?url`; его результат в Rsbuild проверить отдельно.
- Формы, даты, уведомления, модальные окна и charts подключать из экосистемы Mantine по потребности.
- Сначала искать hook в `@mantine/hooks`; `@siberiacancode/react-use` использовать для отсутствующего сценария.
- PWA, service worker и offline cache не появляются автоматически от Mantine или мобильных маршрутов.

Для каждого SSR-запроса создавать отдельный `createI18n`; глобальный изменяемый translator запрещён.
Передавать клиенту тот же locale и snapshot каталогов, с которыми сервер создал HTML.
Кандидат выбора языка: сохранённая настройка/cookie → `Accept-Language` → явный default проекта.
Timezone хранить и передавать отдельно от языка; до определения timezone использовать детерминированный fallback.
Проверить ICU plural rules, даты, числа, fallback ключей и одновременные запросы на разных языках.
CLI extraction/translation работает на этапе разработки; юридические и медицинские тексты проходят редакционную проверку.

## Авторизация: открытая развилка

Нельзя считать `@convex-dev/auth` и `@convex-dev/better-auth` одной библиотекой или незаметно заменить первую второй.
Для исходного Convex Auth подтверждён beta-статус; готовое сочетание Start SSR и native MFA не найдено.
Это отсутствие подтверждения готовой интеграции, а не доказательство технической невозможности.

Рекомендация для решения владельцем архитектуры: **Convex + Better Auth**, если обязательны SSR auth и двухфакторный вход.
Официальный adapter экспортирует `convexBetterAuthReactStart`, `handler`, `getToken`, `fetchAuthQuery`, `fetchAuthMutation`, `fetchAuthAction`.
Маршрут proxy auth обрабатывает GET/POST и сохраняет cookies через документированный механизм.
Гайд содержит Vite `ssr.noExternal` для Better Auth: эквивалентное bundling-поведение в Rsbuild требует проверки.
Two Factor есть в списке поддерживаемых плагинов; организациям/командам через Organization нужен Local Install и проверка схемы.
Local Install означает локально определённый Convex component, а не хранение аккаунтов в браузере.
Права на организации, исследования, клинические данные и цели доступа всё равно проверяются в Convex functions.

При сохранении `@convex-dev/auth` сначала доказать SSR session lifecycle и выбранную MFA-модель в отдельном spike.
Не обещать самописную MFA, SSO или enterprise identity как готовую возможность базового пакета.
Итог развилки записать до реализации аккаунтов; выбрать один источник identity и один session lifecycle.

## Convex Query, TanStack DB и локальная работа

Convex — серверный источник истины; TanStack Query интегрирует серверные запросы и подписки; DB обслуживает локальные коллекции.
Наличие Query adapter и Query Collection по отдельности не доказывает совместимость их композиции.

- В spike явно задать `queryFn` для `queryCollectionOptions` и согласовать его с queryKey/args Convex Query.
- Проверить получение начальных данных, изменение из второго клиента и доставку обновления в DB live query.
- Проверить удаление, смену фильтра, pagination, rollback и отсутствие двух конфликтующих владельцев optimistic state.
- Не обходить несовпадение контрактов через `any` и не принимать один успешный fetch за подтверждение realtime sync.
- SSR создаёт request-scoped клиенты/кэш; браузерные local collections не разделяются между пользователями.
- Persistence хранит строки коллекций; durable outbox хранит ещё не подтверждённые операции. Это отдельные возможности.
- Для outbox нужны стабильные idempotency keys, серверная дедупликация и повторная проверка прав при replay.
- Проверить reload офлайн, повтор после разрыва соединения, конфликт версий, смену пользователя и истёкший доступ.
- В v1 индивидуальные медицинские данные запрещены в Cache Storage, IndexedDB, OPFS, persisted Query/DB и outbox; локально допустимы только нечувствительные черновики и настройки. Расширение — отдельное решение.
- Удаление local cache не отзывает уже выгруженные данные; отзыв доступа контролирует дальнейшие серверные операции.

## Тесты и критерии выхода из spike

Официальный `convex-test` guide использует Vitest, `import.meta.glob` и edge-runtime.
Публичный аргумент `modules` допускает явную карту загрузчиков, но сам по себе не доказывает совместимость с Rstest.
Проверить минимальный сценарий с явной module map; отдельно проверить auth context, scheduler и timers.
При несовместимости использовать Rstest с реальным локальным Convex backend; не заменять runner на Vitest молча.
Для этого есть [официальная стратегия local backend](https://docs.convex.dev/testing/convex-backend).
Интеграционные тесты изолируют данные и не используют production deployment; ограничения mock backend не считаются свойствами production.

Успешный spike должен дать следующие проверяемые результаты:

1. Rsbuild production build запускается; SSR и прямые мобильные/десктопные ссылки работают без hydration warnings.
2. Login, reload, logout, session expiry и две параллельные сессии не смешивают identity или данные.
3. Выбранная MFA проверена вместе с SSR; recovery и отрицательные сценарии зафиксированы.
4. Конкурентные запросы на разных языках не смешивают каталоги; тема и timezone совпадают при hydration.
5. Convex → Query → DB доставляет realtime-изменения и корректно откатывает отказанные операции.
6. Persistence и outbox переживают reload; повторная доставка одной операции не создаёт дубль на сервере.
7. Rstest выполняет выбранный backend test path локально и в CI; неподтверждённые сочетания явно исключены.
8. Точные версии, ограничения и выбранный auth-вариант записаны после фактической проверки.

## TanStack AI и WebMCP

AI подключается к готовым серверным операциям после появления проверяемых прав доступа и контрактов данных.
Использовать согласованные версии пакетов TanStack AI 1.x; experimental harness не нужен для первого помощника.
Серверный MCP и браузерный WebMCP — разные интеграции; их инструменты и жизненные циклы не смешиваются.
WebMCP регистрирует клиентские tools через `document.modelContext` и служит дополнительным способом работы с интерфейсом.
Без поддержки браузера, при SSR или вне secure context основные сценарии CURE продолжают работать.
Начать с поиска, фильтров и навигации; сервер повторно проверяет identity, полномочия и входные данные каждого вызова.
Tools с `needsApproval: true` не регистрируются в WebMCP; annotations не обеспечивают авторизацию или подтверждение.
Выдача доступа, подписание согласия и выгрузки не полагаются на WebMCP как механизм подтверждения.
Проверить отсутствие WebMCP, отмену запроса, ошибки провайдера и unregister при смене маршрута.
Документальная проверка завершена; ни один пункт runtime-приёмки этим документом не объявляется пройденным.
