# Продуктовая аналитика Frigo

Проект PostHog US: https://us.posthog.com/project/684056 (Frigo).
Все посетители — обычные пользователи, отдельных аудиторий нет.
Клиент использует только публичный project token. Personal API key нужен только
локальному `scripts/setup-posthog.mjs` через `POSTHOG_PERSONAL_API_KEY`.

SDK загружается асинхронно; сбой аналитики не блокирует приложение.
Autocapture, автоматические pageview, heatmaps, error capture и запись сессий выключены.
На localhost аналитика выключена; браузерные тесты используют локальный mock SDK.
Ответы онбординга, имена, email, Telegram ID/login, фото, названия собственных рецептов,
содержимое запасов и текст списка покупок не отправляются. `identify` использует внутренний
ID аккаунта; SDK связывает анонимный путь с вошедшим пользователем, logout вызывает reset.
Полные URL и рефереры не отправляются; источники — выбранные UTM и домен реферера.

## События

| Событие | Условие | Параметры |
|---|---|---|
| app_opened | Приложение запущено, один раз на загрузку | authenticated |
| onboarding_started | Первый показ вопросов | — |
| onboarding_step_completed | Успешный переход дальше / запуск меню после последнего вопроса | step_number (1–7) |
| menu_generation_finished | Завершился подбор меню | success, duration_seconds, source: onboarding/rebuild |
| menu_preview_viewed | Показано первое меню до входа | — |
| sign_in_finished | Вход выполнен / окончательная ошибка попытки | success, provider: telegram |
| screen_viewed | Изменился экран, вкладка или вопрос; не каждый render | screen_name, step_number для онбординга |
| menu_approved | Меню впервые стало утверждённым | day_count, person_count |
| recipe_replaced | Подтверждена замена блюда или гарнира | category |
| cooking_started | Первое открытие готовки конкретного блюда на выбранный день | recipe_id, category, cooking_run_id |
| cooking_completed | Блюдо впервые стало приготовленным | recipe_id, category, cooking_run_id и duration_seconds, если начало известно |
| feature_used | Одно из действий ниже | action и параметры ниже |
| engagement_tick | Интервал активного времени | active_seconds, screen_name |

Для приготовления используется фактический результат `completeDish`, поэтому повторное
«Готово» не создаёт второе завершение. Возврат в незавершённую готовку не считается новым
стартом: cooking_run_id сохраняется на устройстве (пользователь + день + слот + рецепт).
Длительность готовки — время между началом и завершением, включая паузы; это отдельная
метрика от активного времени в приложении. Вместо идентификаторов, кодирующих состав
самодельных рецептов, отправляется custom_recipe или публичный базовый ID.

`feature_used.action`:

- recipe_preview_opened — открыта деталка блюда;
- meal_marked_eaten — нажатие «Съели», marked: true/false;
- shopping_item_added_home — покупка действительно изменила запасы;
- shopping_list_shared — успешный share, method: native/telegram/clipboard;
- pantry_scan_finished — распознавание завершилось, success, photo_count, product_count;
- pantry_updated — запасы изменились, method: manual/scan;
- preferences_changed — действие в настройках, section: pFamily/pFood/pDays/pBudget.

Общие свойства: app, analytics_version, surface (домен), first_source, first_medium,
first_campaign. Персональные значения настроек и количества продуктов не передаются.

## Активное время и привлечение

`engagement_tick` суммирует секунды видимой вкладки в фокусе. После 60 секунд без
pointer/keyboard/scroll/touch активность приостанавливается до следующего взаимодействия.
Событие отправляется примерно раз в 15 секунд и при смене экрана, скрытии, потере фокуса
или уходе. Каждое нажатие/прокрутка не создаёт отдельного события. Интервалы не перекрываются.
Сессии определяет SDK PostHog. В отчётах активное время суммируется, затем делится на число
пользователей/сессий; среднее арифметическое отдельных heartbeat-интервалов не используется.

Первый источник сохраняется между визитами браузера: utm_source → внешний домен
реферера → direct. Отдельно сохраняются utm_medium и utm_campaign. Пример ссылки:
`https://frigo-family-menu.pages.dev/?utm_source=telegram&utm_medium=social&utm_campaign=launch`.
GitHub Pages и Cloudflare имеют отдельные анонимные browser ID; после входа они
связываются через единый внутренний user ID.

## Дашборды

- [Активация и функции](https://us.posthog.com/project/684056/dashboard/2251726): DAU,
  упорядоченная воронка, завершённые вопросы, разделы, функции и ошибки.
- [Готовка и сценарии](https://us.posthog.com/project/684056/dashboard/2251727): абсолютные
  начала/завершения, число сценариев на пользователя, распределение готовок включая 0.
- [Возвраты и вовлечённость](https://us.posthog.com/project/684056/dashboard/2251728):
  дневной/недельный retention, активное время по дням, пользователям, сессиям и экранам.
- [Привлечение](https://us.posthog.com/project/684056/dashboard/2251729): источники,
  кампании и новые пользователи.

Retention: первое app_opened → повторное app_opened по дням и неделям. Когорты накопятся
после публикации; исторические действия до внедрения не импортируются из прототипных логов.
Фуннел учитывает только успешные генерацию/вход. Диагностические события подключения
имеют другие имена и в эти отчёты не входят.

Повторная настройка (идемпотентна по именам Frigo и тегу frigo-v1):
`node scripts/setup-posthog.mjs`. С `--validate-only` проверяет запросы без изменения дашбордов.
