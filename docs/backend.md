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

Вход и регистрация объединены: только Telegram-бот, без номера телефона, почты, пароля и тестовых кодов.

- `POST /api/auth/telegram/start` `{}` → `{challengeId,pollToken,code,expiresIn,botUrl}`. Попытка действует 5 минут.
- Пользователь открывает `botUrl`, сравнивает код в приложении и боте и нажимает «Подтвердить вход».
- `POST /api/auth/telegram/poll` `{challengeId,pollToken}` → `{status:"pending"}` либо `{status:"authenticated",user,session}`. Подтверждение обменивается на сессию один раз.
- `POST /api/auth/telegram/webhook` принимает обновления только с верным `X-Telegram-Bot-Api-Secret-Token`. ID и username берутся из этого обновления, не из запроса клиента.
- `POST /api/auth/refresh` `{refreshToken}`, `/api/auth/logout` с Bearer, `GET /api/auth/me`. Старые email/password/OTP endpoints возвращают 404.

`user` содержит `{id,application,providerUserId,login,displayName}`; `application="telegram"`,
`login` — `@username` или имя. Личные данные связаны с внутренним UUID, а не с изменяемым логином.
`TELEGRAM_BOT` — серверный токен бота. При запуске backend регистрирует webhook на
`PUBLIC_API_BASE` (по умолчанию текущий Render URL), при сбое повторяет регистрацию через минуту.
Нужен Supabase server/service-role key (`SUPABASE_API_KEY`, либо `SUPABASE_SERVICE_ROLE_KEY` для admin Auth).
Admin generate_link + verify создаёт стандартные Supabase sessions без отправки писем.
Токены бота, admin-ссылки и технические email не передаются клиенту и не пишутся в логи.
Смена токена бота требует обновить Render и перезапустить backend; аккаунты не изменятся.
Попытки входа временные, в памяти одного backend: после рестарта нужно начать вход заново.

`GET /api/user-state` → `{revision,preferences,menu}`; `PUT` сохраняет оба документа атомарно с той же структурой. `GET/PUT /api/preferences` и `/api/menu` позволяют получить/сохранить соответствующий документ с `revision`. Все данные принадлежат владельцу JWT; конфликт ревизий возвращает 409.

Клиенты обновляют сессию и загружают документы при входе, сохраняют изменения последовательно. Refresh session хранится в Android Keystore-encrypted preferences, iOS Keychain, browser localStorage (Web) или приватном файле (desktop). Личные документы не смешиваются с анонимным черновиком онбординга.

