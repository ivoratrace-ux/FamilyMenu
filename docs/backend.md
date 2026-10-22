# Backend FamilyMenu на Render

Сервер из архива перенесён в `backend/` текущего репозитория
`ivoratrace-ux/FamilyMenu`. Старый репозиторий больше не используется.
Существующий сервис: `https://vibe-coding-sc04.onrender.com`.

## Настройки существующего сервиса

- Repository: `ivoratrace-ux/FamilyMenu`, Branch: `main`.
- Root Directory: пусто (package.json находится в корне).
- Runtime: Node.js 24; Build Command: `npm ci && npm test`.
- Start Command: `npm start`; Health Check Path: `/health`.
- Оставить существующие `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_API_KEY`.
- Для входа через мессенджеры: `MESSENGER_AUTH_SECRET`, `TELEGRAM_GATEWAY_TOKEN`, `MAX_BOT_TOKEN`, `MAX_BOT_NAME` (см. ниже).
- Сервис слушает `0.0.0.0` и порт из Render `PORT`.

`render.yaml` документирует эти настройки; смена репозитория сама по себе
не применяет Blueprint к существующему сервису. Для Docker runtime используется
корневой `Dockerfile`: он запускает тесты при сборке и API от непривилегированного пользователя.
Не нужно создавать второй сервис или переносить ключи в клиент.

## Локальная проверка и CI

Node.js 24: `npm ci`, `npm test`, `npm start`. Необязательный `.env` создаётся
по `.env.example`. Настоящие ключи нужны только для обращений к провайдерам.
Workflow **Backend checks** проверяет тесты, Docker-сборку, запуск и HTTP-контракт.
Изменения только backend не запускают Gradle-сборки клиентов.

`/health` возвращает `service: family-menu-api`, `revision` из `RENDER_GIT_COMMIT`
и статус настройки OpenAI. Это позволяет проверить, какая ревизия реально развернулась.
Ключи в ответ не включаются. `/health/auth` и `/health/supabase` сохранены.

`node scripts/check-scan-backend.mjs` проверяет готовность, OPTIONS и пустой POST
сканера (ожидаются 204 и 400). Фото и платные запросы не отправляются.
Для другой среды задать `BACKEND_URL`; для проверки релиза — `EXPECTED_REVISION`.

## Поток данных

Камера/галерея → очередь до 5 фото с миниатюрами и удалением → локальное уменьшение и JPEG → JSON `images[]` с Base64 → Render + актуальный справочник Supabase → один запрос OpenAI
`gpt-4.1-mini` → проверка результата сервером → Kotlin-клиент → временный список «Дома».
Backend проверяет все ID ингредиентов и альтернатив по справочнику, объединяет повторные наблюдения и не удваивает количество на перекрывающихся снимках. Названия для известных ID берутся из базы, для неизвестных продуктов возвращается `ingredientId: null`. Пользователь выбирает неоднозначные варианты; продукты вне справочника показаны отдельно. Подтверждение альтернатив и удаление изменяют только временный список.
Фотографии и черновик распознавания не сохраняются. Проверенный список ингредиентов записывается в запасы только по кнопке «Сохранить».

Добавлены `GET /api/catalog` (Supabase) и `/assets/art/*.png` (статические картинки).
Схема, импорт и права: [database.md](database.md).
Сохранены маршруты `/api/fridge/scan`, `/api/meals` и `/api/auth/*`.
Генерация рациона и Supabase Auth пока не подключены к Compose UI.
Корень API возвращает метаданные; веб-клиент публикуется отдельно в GitHub Pages.

Origin `https://ivoratrace-ux.github.io` разрешён по умолчанию. Дополнительные
origins добавляются через `ALLOWED_ORIGINS`; старое значение не блокирует FamilyMenu.
Локальные порты 8080 и 8000 разрешены для localhost/127.0.0.1.
Wildcard не используется; Android/iOS не ограничены браузерным CORS.

## Ограничения

Клиент ограничивает очередь до 5 фото, каждое до 4 МБ и ждёт до 150 секунд, включая пробуждение Render.
Сервер ограничивает сканирование 30 запросами в час и двумя активными запросами.
Настоящее распознавание проверяется отдельно фотографией; тесты с заглушками
не доказывают доступность OpenAI или действительность серверных ключей.

Deploy webhook позволяет запустить деплой, но не читать логи или менять настройки.
Для управления через Render API нужен API key, переданный через секрет окружения
`RENDER_API_KEY`, а не через репозиторий или сообщения чата.

### Совместимость сканера

Новый контракт: `POST /api/fridge/scan` с `{images: [{image, mimeType}]}` (1–5 изображений, JPEG/PNG/WebP). Ответ содержит `ingredientId`, `name`, `amount`, `confidence`, `alternatives: [{ingredientId, name}]`. При недоступном справочнике возвращается 503 до платного запроса; при несуществующем ID в ответе модели — безопасная ошибка 502. Старые клиенты с `{image, mimeType}` по-прежнему получают строковые альтернативы; это позволяет обновлять backend раньше клиентов. Результаты, фото и выбор пользователя не записываются в Supabase или запасы.

## API запасов

- `GET /api/inventory` → `{userEmail, revision, items: [{ingredientId, name, unit, quantity}]}`.
- `PUT /api/inventory` с `{revision, items: [{ingredientId, quantity}]}` целиком заменяет список.
- `PUT /api/inventory/item` с `{revision, ingredientId, quantity}` добавляет ингредиент или заменяет его количество.
- `DELETE /api/inventory/item` с `{revision, ingredientId}` удаляет ингредиент.
- `GET /api/ingredients?q=...` ищет по имени от 3 до 80 символов, возвращает максимум 20 `{id, name, unit}` в `ingredients`.

Все операции с запасами требуют Bearer JWT и используют только владельца сессии. Прямые пользовательские ID не принимаются. Количество хранится в единице ингредиента, до трёх десятичных знаков. Конфликты ревизии возвращают 409.

## Авторизация и личные данные

`POST /api/auth/register` и `/api/auth/login`: `{email,password}` (8–128 символов). Возвращают пользователя и access/refresh session, без серверных ключей. `POST /api/auth/refresh` принимает `{refreshToken}`, `/api/auth/logout` — Bearer access token, `/api/auth/me` проверяет пользователя через Supabase. Старые OTP endpoints удалены.

Запасы, поиск ингредиентов, сканирование, `/api/meals`, `/api/user-state`, `/api/menu`, `/api/preferences` требуют пользовательский Bearer JWT. Backend подтверждает его через Supabase Auth и передаёт тот же токен в RPC. Каталог, картинки, health и маршруты входа публичны. Первое меню после онбординга формируется существующим локальным Kotlin-движком по публичному каталогу; платный `/api/meals` не открывается анонимным посетителям.

`GET /api/user-state` → `{revision,preferences,menu}`; `PUT` сохраняет оба документа атомарно с той же структурой. `GET/PUT /api/preferences` и `/api/menu` позволяют получить/сохранить соответствующий документ с `revision`. Все данные принадлежат владельцу JWT; конфликт ревизий возвращает 409.

Клиенты обновляют сессию и загружают документы при входе, сохраняют изменения последовательно. Пароль не хранится. Refresh session хранится в Android Keystore-encrypted preferences, iOS Keychain, browser localStorage (Web) или приватном файле (desktop). Личные документы не смешиваются с анонимным черновиком онбординга.

## Вход через Telegram и MAX

`GET /api/auth/messengers` → `{telegram,max}` — какие способы настроены. Без настроек соответствующие
маршруты отвечают 503, а клиент предлагает вход по почте.

- **Telegram** (Telegram Gateway API, `TELEGRAM_GATEWAY_TOKEN`): `POST /api/auth/telegram/start {phone}` отправляет
  4-значный код в Telegram и возвращает `{challengeId,expiresIn,via,destination}` (номер замаскирован);
  `POST /api/auth/telegram/verify {challengeId,code}` проверяет код через `checkVerificationStatus`.
- **MAX** (бот, `MAX_BOT_TOKEN`, `MAX_BOT_NAME`): `POST /api/auth/max/start` возвращает ссылку
  `https://max.ru/<бот>?start=<challengeId>`. Когда пользователь открывает бота, MAX присылает webhook
  на `/api/max/webhook/<секрет>`, бот отвечает кодом; `POST /api/auth/max/verify {challengeId,code}`.
  Webhook подписывается один раз: `MESSENGER_AUTH_SECRET=… MAX_BOT_TOKEN=… MAX_BOT_NAME=… node scripts/max-subscribe.mjs https://vibe-coding-sc04.onrender.com`.

Код живёт 5 минут, не больше 5 попыток; лимиты: 1 отправка в минуту и 5 в час на номер, 20 проверок в минуту.
Пользователь Supabase создаётся автоматически: email `<telegram|max>-<HMAC>@users.familymenu.invalid`,
пароль — HMAC от `MESSENGER_AUTH_SECRET`; номер телефона и ID в MAX в базе не хранятся.
**`MESSENGER_AUTH_SECRET` нельзя менять** после запуска: иначе вошедшие через мессенджер потеряют доступ к аккаунтам.
Ответ verify совпадает с `/api/auth/login` плюс `login:{via,display}`.
