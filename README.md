# Семейное меню · Kotlin Multiplatform

FamilyMenu перенесён с HTML/JavaScript на **Compose Multiplatform**: общий интерфейс
и логика для Web (Wasm), Android и iOS. Основное приложение — FamilyMenu;
из второго проекта перенесён сценарий распознавания холодильника.

## Что работает

- Пять вводных слайдов (что бесплатно, что в Premium), вход и регистрация через Telegram-бота:
  пользователь открывает бота, сверяет код и подтверждает вход. Почта, пароль, тестовый вход
  и MAX убраны. Повторный вход по тому же Telegram ID возвращает данные аккаунта.
- Знакомство в 6 шагов: семья, рост/вес/возраст, активность, тип питания, ограничения, выбор
  сценария — «Приготовить из того, что есть» или «Меню на неделю».
- Пять вкладок: **Главная**, **Готовить**, **Неделя**, **Покупки**, **Профиль**; подстраницы профиля
  открываются со стрелкой «назад».
- «Готовить»: отметки «Что есть дома» (сохраняются на сервере), фото холодильника, подбор
  **основного блюда + гарнира**, супа или целого блюда по минимуму докупки, рецепт по шагам,
  списание использованного и добавление недостающего в покупки.
- Premium (бюджет, цены, калории/КБЖУ) открывается через неделю: 7 дней бесплатно, дальше 299 ₽/мес;
  в прототипе оплата не списывается. В профиле есть перемотка дней для пилота и экран метрик.
- Подбор недели на устройстве из **175 рецептов** (в т.ч. 18 основных блюд и 13 гарниров), загружаемых через backend из Supabase, замены, перемещение
  самостоятельных блюд между слотами, приготовление супа на два дня.
- Оригинальные иллюстрации блюд и шагов, цвета, шрифты Golos Text / Literata,
  карточки, узкая мобильная колонка, нижняя навигация, светлая и тёмная темы.
- Рецепты с граммовками, пошаговое приготовление и таймеры; отметки «Съели»,
  приблизительные калории и локальный словарь дополнительной еды.
- Список покупок с объединением ингредиентов, выбором магазина, отметками покупок
  и ссылками. Цены — исходный снимок 20–21.10.2026, не live-интеграция магазинов.
- Запасы «Что есть дома» загружаются с backend и вычитаются из списка покупок. Обновление по 1–5 фото с проверкой продуктов и полным замещением списка по кнопке «Сохранить». Web предлагает только прикрепление фото, Android/iOS — камеру и галерею.

Запасы хранятся в Supabase для **авторизованного пользователя**. Вход — подтверждение через Telegram-бота; общий тестовый аккаунт удалён. Фото и черновик распознавания не сохраняются. До подтверждения замены прежние запасы не меняются. Количество задаётся в единицах справочника; неоднозначные и неизвестные продукты нужно уточнить или удалить.
Нормы калорий и распознавание приблизительные. Знакомство с семьёй начинается после входа. Демо-режим удалён. Текущее меню и предпочтения сохраняются на пользователя.

## Структура

```
composeApp/src/commonMain/   # Compose UI, подбор, покупки, catalog/scanner HTTP clients
composeApp/src/androidMain/ # Android Activity, камера/галерея, сжатие, SharedPreferences
composeApp/src/iosMain/     # UIKit photo picker, NSUserDefaults, ComposeUIViewController
composeApp/src/wasmJsMain/  # Browser entrypoint, file/camera picker, localStorage
composeApp/src/desktopMain/ # JVM runner для разработки и общих тестов
composeApp/src/commonTest/  # Политика распознавания, подтверждения, таймеры
composeApp/src/desktopTest/ # Полный каталог, подбор, ограничения, покупки, сериализация
iosApp/                    # SwiftUI host, Info.plist, XcodeGen project specification
backend/                   # Node.js API, исходный снимок каталога, статические PNG и тесты
supabase/                  # SQL-миграции и проверки прав/целостности базы
legacy/                    # Исходный HTML/JS FamilyMenu для сравнения и миграции данных
scripts/                   # Обновление ресурсов и проверка scanner API
```

Приложение не использует WebView: интерфейс на всех целевых платформах — Compose.
В Web нужен современный браузер с поддержкой WebAssembly GC.
Исходный `localStorage` ключ `family-menu-proto-v4` оставлен нетронутым;
Compose использует отдельный ключ `family-menu-compose-v1` и не импортирует старое состояние.

## Инструменты

JDK 17, Gradle 8.11.1 (wrapper с SHA-256), Kotlin 2.2.20, Compose Multiplatform 1.9.1,
Ktor 3.3.0, kotlinx.serialization / kotlinx.datetime (0.7.1 с совместимостью ABI 0.6). Для Android: SDK 35, minSdk 26.
Для iOS: macOS, Xcode 16.4, iOS 15+, XcodeGen. Python/Node не нужны для сборки основных приложений.

Используйте существующий checkout: отдельный Git worktree не требуется.

```bash
# Общая логика и проверки полного каталога (Linux/macOS)
./gradlew :composeApp:desktopTest

# Android: установка SDK через Android Studio или setup-android; затем
./gradlew :composeApp:assembleDebug :composeApp:lintDebug
# APK: composeApp/build/outputs/apk/debug/composeApp-debug.apk

# Web: локальная разработка
./gradlew :composeApp:wasmJsBrowserDevelopmentRun

# Web: статическая production-сборка
./gradlew :composeApp:wasmJsBrowserDistribution
# Результат: composeApp/build/dist/wasmJs/productionExecutable/
```

На iOS сначала сгенерируйте проект из сохранённой спецификации:

```bash
cd iosApp
brew install xcodegen
xcodegen generate
cd ..
xcodebuild -project iosApp/FamilyMenu.xcodeproj -scheme FamilyMenu \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath iosApp/build ARCHS=arm64 ONLY_ACTIVE_ARCH=NO \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

Это сборка приложения для симулятора, а не подписанный IPA. Apple Developer account
для этой проверки не нужен. Запуск на физическом iPhone и App Store требуют подписи
и не входят в текущую настройку.

## Backend и Supabase

Адрес: `https://vibe-coding-sc04.onrender.com`.
Каталог загружается через `GET /api/catalog` из таблиц Supabase. При ошибке есть
повторная попытка; встроенный JSON больше не используется. Схема и команды миграции:
[docs/database.md](docs/database.md).

Для сканирования общий клиент отправляет `POST /api/fridge/scan`:

```json
{"images":[{"image":"<base64 без data URL prefix>","mimeType":"image/jpeg"}]}
```

Ответ: `products[]` с `ingredientId` (ID из актуального справочника Supabase или `null`), `name`, `amount`, `confidence`, `alternatives`. Альтернативы — объекты `{ingredientId, name}`. Backend передаёт все снимки и справочник одним запросом в OpenAI, проверяет ID, заменяет названия на справочные и объединяет дубликаты. Продукты вне справочника показаны отдельно. Перекрывающиеся снимки не суммируются как независимые количества.
`high` показывается сразу; `medium` с альтернативами требует выбора пользователя или удаления; `low` не показывается. Клиенты нормализуют фото до JPEG,
уменьшают примерно до 1600 px и ограничивают размер каждого фото 4 МБ. В очереди максимум 5 фото. Ожидание — до 150 секунд.
В браузере кнопка камеры зависит от устройства: desktop обычно открывает выбор файла.

Backend теперь находится в этом репозитории, в `backend/`. Существующий сервис
Render использует FamilyMenu; адрес и серверные ключи OpenAI/Supabase сохраняются.
Фото передаётся через Render в OpenAI.

Для Render: Root Directory оставить пустым, Node.js 24, Build Command —
`npm ci && npm test`, Start Command — `npm start`, Health Check Path — `/health`.
В корне также есть проверенный Dockerfile и справочный `render.yaml`.
Подробности: [docs/backend.md](docs/backend.md).

Локальный запуск: `npm ci`, затем `npm test` и `npm start`.
Переменные задаются в `.env` по образцу `.env.example`; ключи в Git не добавлять.

### CORS для GitHub Pages

Origin `https://ivoratrace-ux.github.io` разрешён сервером по умолчанию, включая
случай, когда в Render осталась старая переменная `ALLOWED_ORIGINS`.
Дополнительные origins задаются в ней через запятую, без пути `/FamilyMenu/`.

Без платного вызова OpenAI можно проверить route и CORS:

```bash
node scripts/check-scan-backend.mjs
```

Или запустить action **Check existing scanner API**. Эта проверка не отправляет фото.
Настоящее распознавание проверяется фотографией из приложения; unit-тесты не доказывают
доступность действующего Render/OpenAI.

## GitHub Actions

- **Backend checks**: при изменении API запускает Node.js тесты и проверяет Docker-контейнер,
  health, CORS и валидацию сканера без вызовов OpenAI.
- **Build multiplatform apps**: при изменении клиентов на push в `main` и pull request запускает общие тесты,
  собирает и проверяет Android debug APK, production Web и iOS simulator `.app` без подписи.
  Web дополнительно проходит браузерный сценарий с подменённым API сканера.
  Результаты доступны в artifacts. Android debug APK использует публичный ключ
  разработки из проекта сканера для обновлений между сборками; это не release-подпись.
- **Publish Compose Web to GitHub Pages**: вызывается основным workflow после
  успешного Web job на `main`, не ожидая Android и iOS; публикует уже собранный Web artifact
  без повторной компиляции. В Settings → Pages выберите **GitHub Actions**.
  Для этого репозитория ожидаемый адрес: `https://ivoratrace-ux.github.io/FamilyMenu/`.
- **Backend checks** на `main` после тестов вызывает Render deploy hook из секрета `RENDER_DEPLOY_HOOK`
  (если секрет не задан — шаг пропускается).
- **Database migrate** (вручную): `npm run db:migrate` + `db:verify` с секретом `SUPABASE_ACCESS_TOKEN`.
- **Check existing scanner API**: ручная проверка CORS / маршрута без расходов OpenAI.

Не публикуется исходная папка `legacy/`; в Pages попадает только сборка Compose.
Cloud / Claude Artifacts не изменяются. Workflows начнут выполняться после push;
наличие YAML не означает, что удалённая сборка или публикация уже прошла.

## Браузерная проверка

После production-сборки: `CHROME_BIN=chromium node scripts/web-smoke.mjs`
(Node.js 24; в GitHub Actions используется установленный `google-chrome`
с программным рендерингом SwiftShader для headless VM). Проверяется
путь `/FamilyMenu/`, слайды, подтверждение входа через Telegram, знакомство, меню на неделю, утверждение,
корзина, «Готовить из того, что есть» с пошаговым рецептом и списанием, фото холодильника и замена запасов,
обновление сессии после перезагрузки, пробный Premium, выход, повторный вход в тот же аккаунт и изоляция второго Telegram-аккаунта.
Ошибки выводятся как GitHub annotations. Catalog, image и Scanner API подменяются внутри Chrome: реальных
фотографий и платных запросов в этой проверке нет. Скриншот сохраняется в build/reports.

## Ресурсы и границы переноса

Каталог экспортирован в `backend/data/catalog.seed.json` для миграции в Supabase.
Все 732 иллюстрации находятся в `backend/public/art/` и раздаются Render по URL из базы. При необходимости обновления:
`node scripts/export-catalog.cjs`, затем `python scripts/rasterize-catalog.py`
(для этой операции нужен CairoSVG). Лицензии шрифтов находятся в `docs/licenses/`.

Перемещение блюд выполняется выбором исходного и целевого слота вместо HTML drag-and-drop.
Супы партиями и зависимые остатки отдельно не перемещаются. Запасы хранятся в Supabase для авторизованного пользователя, учитываются в покупках и списываются после приготовления.
Напоминания и таймеры работают при открытом приложении; фоновые push не добавлены.
Опциональный Claude Artifacts API отсутствует в Compose-приложении: локальный словарь
для калорий сохранён, backend OpenAI используется только для сканирования.

## Аккаунт и синхронизация

Каталог и изображения доступны без входа. После вводных слайдов требуется подтверждение
в Telegram-боте. Первый вход создаёт аккаунт, следующие восстанавливают текущее меню,
предпочтения и запасы. Изменения сохраняются на backend, при выходе личное состояние очищается.
В профиле хранится приложение входа и Telegram ID, показывается @username или имя.
Старые аккаунты сохраняются без переноса. Настройка серверного TELEGRAM_BOT и API описана в [docs/backend.md](docs/backend.md).
