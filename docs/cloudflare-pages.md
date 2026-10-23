# Публикация Web

Workflow `Build Web` проверяет сайт и создаёт артефакт `family-menu-web`.
GitHub Pages и Cloudflare Pages публикуют один и тот же проверенный артефакт
параллельно; ошибка одного хостинга не блокирует другой. Pull request не публикуется.

Cloudflare Pages использует Direct Upload (без подключения Cloudflare Git integration):
проект `frigo-family-menu`, production branch `main`. Отдельная сборка не нужна. Проект создаётся автоматически при первой публикации.

Настройки GitHub Actions репозитория:

- Secret `CLOUDFLARE_API_TOKEN`: Cloudflare API token с разрешением
  Account → Cloudflare Pages → Edit для нужного аккаунта.
Account ID `4a47141298893f1201ca572962ed563d` задан в workflow; это публичный идентификатор, не секрет.

После настройки секрета запустите `Build Web` вручную или отправьте изменение Web в main.
Токен можно заменить в Secrets без изменения кода. В исходниках и артефакте сайта его нет.

Production origin `https://frigo-family-menu.pages.dev` разрешён в бэкенде Render
вместе с GitHub Pages. Preview-домены не получают доступ к API автоматически.
При смене домена обновите разрешённые origin в бэкенде или `ALLOWED_ORIGINS`
(разделитель — запятая).
