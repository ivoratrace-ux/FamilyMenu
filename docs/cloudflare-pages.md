# Публикация Web

Workflow `Build Web` проверяет сайт и создаёт артефакт `family-menu-web`.
GitHub Pages и Cloudflare Pages публикуют один и тот же проверенный артефакт
параллельно; ошибка одного хостинга не блокирует другой. Pull request не публикуется.

Cloudflare Pages использует Direct Upload (без подключения Cloudflare Git integration):
проект `frigo-family-menu`, production branch `main`. Отдельная сборка не нужна. Проект создаётся автоматически при первой публикации.

Настройки GitHub Actions репозитория:

- Secret `CLOUDFLARE_API_TOKEN`: Cloudflare API token с разрешением
  Account → Cloudflare Pages → Edit для нужного аккаунта.
- Variable `CLOUDFLARE_ACCOUNT_ID`: ID аккаунта Cloudflare.

Пока Account ID не задан, публикация Cloudflare пропускается. GitHub Pages продолжает
работать. После настройки запустите `Build Web` вручную или отправьте изменение Web в main.
Токен можно заменить в Secrets без изменения кода. В исходниках и артефакте сайта его нет.

Новый production origin необходимо добавить в разрешённые origin бэкенда Render
(`ALLOWED_ORIGINS`, разделитель — запятая), сохранив GitHub Pages. Preview-домены
не получают доступ к API автоматически.
