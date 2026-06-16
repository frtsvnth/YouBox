# Operations: эксплуатация YouBox на VPS

> Раздел для администратора сервиса: healthcheck, логи, бэкапы, обновление, откат.

---

## Healthcheck

Docker HEALTHCHECK настроен в `docker-compose.yml`:

```yaml
healthcheck:
  test: /healthcheck.sh
  interval: 30s
  timeout: 10s
  start_period: 30s  # даём время на запуск
  retries: 3
```

### Статусы

| Health status | HTTP /api/health | Exit code | Действие Docker |
|--------------|------------------|-----------|-----------------|
| `healthy` | `"status": "ok"` | 0 | Всё хорошо |
| `unhealthy` | `"status": "degraded"` | 1 | Пишет в лог, НЕ перезапускает |
| `unhealthy` | `"status": "error"` | 2 | Перезапускает контейнер |

### Проверка статуса

```bash
# Через docker
docker inspect --format='{{json .State.Health}}' youbox | python3 -m json.tool

# Через API
curl -s http://localhost:3007/api/health | python3 -m json.tool

# Быстрая проверка
curl -s -o /dev/null -w "%{http_code}" http://localhost:3007/api/health
```

### Когда статус degraded

- **Cookies настроены, но файл отсутствует** — создайте или скопируйте cookies.txt (`chmod 644`)
- **yt-dlp не установлен** — пересоберите образ (`docker compose build --pull`)
- **ffmpeg не установлен** — пересоберите образ
- **yt-dlp жалуется на JS runtime** — проверьте версию yt-dlp и наличие node в контейнере

Контейнер продолжает работать, но функциональность может быть ограничена.

---

## Логирование

### Docker-логи

```bash
# Все логи
docker compose logs youbox

# Последние 50 строк
docker compose logs --tail=50 youbox

# В реальном времени
docker compose logs -f youbox

# За последний час
docker compose logs --since=1h youbox
```

### Уровни логирования

Устанавливаются через `LOG_LEVEL` в `.env`:

| Уровень | Когда использовать |
|---------|-------------------|
| `error` | production — только ошибки |
| `warn` | production + предупреждения |
| `info` | по умолчанию: старт/стоп задач |
| `debug` | диагностика: аргументы subprocess (secrets redacted) |

**В production рекомендуется `info`.**

### Ротация логов Docker

Настроена в `docker-compose.yml`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"   # максимум 10MB на файл
    max-file: "3"     # 3 файла = 30MB всего
```

### Что не попадает в логи

- Содержимое cookies-файла — аргумент `--cookies` redactится (заменяется на `<redacted>`)
- Значение APP_PIN_HASH / AUTH_PIN — не логируются
- Полный `process.env` — subprocess получает только `{PATH, HOME, LOG_LEVEL}`

---

## Бэкапы

Скрипт: `/opt/youbox/deploy/backup.sh`

### Запуск

```bash
# В директорию backups/ внутри проекта
./deploy/backup.sh

# В указанную директорию
./deploy/backup.sh /opt/backups/youbox
```

### Что бэкапится

| Файл | Содержимое |
|------|-----------|
| `youbox_20260101_030000.db` | SQLite (через `.backup`, безопасно для WAL) |
| `jobs_20260101_030000.json` | Метаданные всех задач |
| `downloads_manifest_20260101_030000.txt` | Список файлов в /data/downloads |

### Автоматизация (cron)

```bash
# Ежедневно в 3:00
0 3 * * * /opt/youbox/deploy/backup.sh /opt/backups/youbox 2>&1 | logger -t youbox-backup

# Раз в неделю — копия на внешнее хранилище (пример с rsync)
0 4 * * 1 rsync -a /opt/backups/youbox/ user@backup-server:/backups/youbox/
```

### Восстановление

```bash
# Остановка контейнера
docker compose stop youbox

# Восстановление БД из бэкапа
docker cp /opt/backups/youbox/youbox_20260101_030000.db youbox:/data/db/youbox.db

# Запуск
docker compose start youbox
```

### Очистка

Скрипт автоматически удаляет бэкапы старше 30 дней. Настройка — в `backup.sh`, строка с `-mtime +30`.

---

## Обновление приложения

### Стандартное обновление

```bash
cd /opt/youbox

# 1. Бэкап
./deploy/backup.sh

# 2. Обновление
./deploy/deploy.sh --update
```

### Что делает `deploy.sh --update`

1. Бэкап БД
2. `git pull` (если есть .git)
3. `docker compose build --pull --no-cache`
4. `docker compose up -d --force-recreate`
5. `docker image prune -f`

### Обновление только yt-dlp

yt-dlp обновляется часто, независимо от приложения. YouTube также требует
JS runtime для расшифровки форматов — node.js встроен в образ, поэтому
достаточно обновить yt-dlp:

```bash
# Без перезапуска
./deploy/update-yt-dlp.sh

# С перезапуском
./deploy/update-yt-dlp.sh --restart
```

---

## Откат

### Через deploy.sh

```bash
./deploy/deploy.sh --rollback
```

### Вручную

```bash
# 1. Откатить код (если используется git)
git checkout <previous-tag-or-commit>

# 2. Пересобрать и запустить
docker compose build
docker compose up -d --force-recreate

# 3. Если нужно откатить БД — восстановите из бэкапа
docker compose stop youbox
docker cp /opt/backups/youbox/youbox_20260101_030000.db youbox:/data/db/youbox.db
docker compose start youbox
```

---

## Обслуживание VPS

### Проверка места на диске

```bash
# Общее использование
df -h

# Данные YouBox
du -sh /opt/youbox/data/
du -sh /opt/youbox/backups/
du -sh /var/lib/docker/

# Очистка Docker
docker system prune -f
```

### Полный ребут сервера

```bash
# Docker Compose с restart: unless-stopped запустится автоматически
sudo reboot

# После перезагрузки проверьте:
docker compose ps
```

### Обновление системы

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get autoremove -y
# Перезагрузите для применения обновлений ядра
sudo reboot
```

---

## Мониторинг (опционально)

### Uptime Robot / Healthchecks.io

```bash
# Проверка извне (если используется reverse proxy с доменом)
curl -s https://youbox.example.com/api/health
```

Ожидаемый ответ (HTTP 200):
```json
{
  "status": "ok",
  "app": { "uptime": 123456 },
  "ytDlp": { "available": true, "version": "2026.06.09" },
  "ffmpeg": { "available": true, "version": "5.1.9" },
  "cookiesFile": { "available": true, "path": null },
  "database": { "available": true, "jobCount": 5 }
}
```

### Alerting

При `status: "degraded"`:
- Docker не перезапускает контейнер (exit 1)
- Мониторинг может среагировать на HTTP 200 с `status: degraded`

При `status: "error"`:
- Docker перезапускает контейнер (exit 2)
- Возможен downtime до 30s (start_period)

---

## Безопасность логов

| Данные | Куда попадают | Риск |
|--------|--------------|------|
| APP_PIN_HASH | process.env → subprocess → НЕ логируется | Низкий (не логируется) |
| AUTH_PIN | process.env → subprocess → НЕ логируется | Низкий (не логируется) |
| COOKIE_SECURE | process.env | Низкий (не секрет) |
| Cookies path | `/api/health` — path скрыт (`null`) | Низкий (path не отдаётся) |
| Cookies contents | аргумент `--cookies <path>` → redacted | Нулевой (redacted в debug) |
| URL видео | Логи воркера (info) | Средний (это user-data) |

**Рекомендация**: если логи доступны третьим лицам, установите `LOG_LEVEL=error`.
