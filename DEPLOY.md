# YouBox — деплой на VPS за существующим Traefik

> Сценарий для VPS, где уже работает Traefik в Docker. YouBox подключается к внешней сети Traefik и не требует отдельного reverse proxy.

---

## Содержание

1. [Что нужно проверить на VPS и у DNS-провайдера перед деплоем](#что-нужно-проверить-на-vps-и-у-dns-провайдера-перед-деплоем)
2. [Деплой YouBox за Traefik](#деплой-youbox-за-traefik)
3. [Проверка после деплоя](#проверка-после-деплоя)
4. [Обновление приложения](#обновление-приложения)
5. [Firewall и безопасность](#firewall-и-безопасность)
6. [Бэкапы](#бэкапы)
7. [Cookies](#cookies)
8. [Troubleshooting](#troubleshooting)

---

## Что нужно проверить на VPS и у DNS-провайдера перед деплоем

### DNS

| Проверка | Команда / Действие |
|----------|-------------------|
| Публичный IP VPS | `curl -s ifconfig.me` |
| A-запись для YouBox | `dig youbox.example.com +short` — должен вернуть IP VPS |
| Отсутствие NXDOMAIN | `dig youbox.example.com` — должен быть NOERROR |
| Совпадение host rule и DNS имени | `YOUBOX_HOST` в `.env` = тому же домену, что в A-записи |

### Traefik

| Проверка | Команда / Действие |
|----------|-------------------|
| Traefik запущен | `docker ps \| grep traefik` |
| Имя контейнера Traefik | `docker inspect root-traefik-1 --format '{{json .NetworkSettings.Networks}}'` |
| Сеть Traefik | `docker inspect root-traefik-1 --format '{{json .NetworkSettings.Networks}}'` — ожидается `root_default` |
| Логи Traefik | `docker logs root-traefik-1 --tail 200` — проверить ошибки |
| CertResolver | В логах Traefik должно быть `mytlschallenge` (если используется) |
| EntryPoint websecure | Traefik должен слушать 443/tcp |
| Нет конфликтующего router для того же host | `docker logs root-traefik-1 --tail 200 \| grep -i router` |
| Docker socket доступен | Traefik должен иметь доступ к `/var/run/docker.sock` (типичная конфигурация) |
| Порты 80/443 открыты наружу | `ufw status` — должны быть разрешены |

### Причины текущего unhealthy статуса

Контейнер YouBox сейчас показывает `unhealthy` **не из-за приложения**, а из-за того, что `healthcheck.sh` использует `wget`, которого нет в образе `node:22-slim`. В текущей версии healthcheck переписан на `node` — он будет работать.

---

## Деплой YouBox за Traefik

### 1. Подготовка сервера

```bash
ssh root@141.136.44.9

# Проверка Docker
docker --version && docker compose version

# Проверка сети Traefik
docker inspect root-traefik-1 --format '{{json .NetworkSettings.Networks}}'
# Ожидается: root_default
```

### 2. Клонирование репозитория

```bash
cd /opt
git clone git@github.com:frtsvnth/YouBox.git youbox
cd /opt/youbox
```

### 3. Настройка .env

```bash
cp .env.example .env
nano .env
```

**Обязательно измените:**
- `APP_PIN_HASH` — сгенерируйте свой:
  ```bash
  echo -n "твой-секретный-пин-код" | shasum -a 256 | cut -d' ' -f1
  ```
- `YOUBOX_HOST` — ваш домен (например, `youbox.example.com`)

**Проверьте, что совпадает с вашим Traefik:**
- `TRAEFIK_NETWORK=root_default` — имя сети из `docker inspect`
- `TRAEFIK_ENTRYPOINTS=websecure` — entrypoint Traefik
- `TRAEFIK_CERTRESOLVER=mytlschallenge` — ваш certresolver

**Для HTTPS добавьте:**
```env
COOKIE_SECURE=true
```

### 4. Подключение к внешней сети Traefik

YouBox подключается к external network `root_default`:

```
youbox → [youbox_internal + root_default] → Traefik
```

Сеть `root_default` уже существует на VPS. В `docker-compose.yml` она объявлена как `external: true`. Docker Compose не создаёт её, а подключается к существующей.

### 5. Запуск

```bash
# Сборка и запуск
docker compose build
docker compose up -d

# Проверка
docker compose ps
docker inspect youbox --format '{{json .State.Health}}' | python3 -m json.tool
```

### 6. Проверка, что Traefik увидел labels

```bash
docker logs root-traefik-1 --tail 50 | grep -i youbox
# Ожидается: router youbox@docker, service youbox@docker

# Прямая проверка через Traefik API (если включен)
curl -s http://localhost:8080/api/http/routers | python3 -m json.tool | grep youbox
```

### 7. Проверка доступности по домену

```bash
# С VPS (локально)
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://youbox.example.com/api/health

# С любого компьютера
curl -s https://youbox.example.com/api/health | python3 -m json.tool
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "app": { "uptime": 123 },
  "ytDlp": { "available": true, "version": "2026.06.09" },
  "ffmpeg": { "available": true, "version": "5.1.9" },
  "cookiesFile": { "available": false, "path": null },
  "database": { "available": true, "jobCount": 0 }
}
```

---

## Проверка после деплоя

```bash
# Статус контейнера
docker compose ps

# Healthcheck
docker inspect youbox --format='{{json .State.Health}}' | python3 -m json.tool

# Логи приложения
docker compose logs --tail=50 youbox

# Логи Traefik (убедиться, что нет ошибок по роутеру youbox)
docker logs root-traefik-1 --tail 100 | grep -E "youbox|error"

# Доступность по домену
curl -sI https://youbox.example.com | head -5

# Статус Traefik dashboard (если включен)
curl -s http://localhost:8080/api/http/routers | python3 -m json.tool | grep -A2 youbox
```

---

## Обновление приложения

```bash
cd /opt/youbox

# 1. Бэкап
./deploy/backup.sh

# 2. Pull новых изменений
git pull

# 3. Пересборка и перезапуск
docker compose build --pull
docker compose up -d --force-recreate

# 4. Очистка старых образов
docker image prune -f

# 5. Проверка
docker compose ps && curl -s https://youbox.example.com/api/health | python3 -m json.tool
```

---

## Firewall и безопасность

### UFW

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh                 # SSH (порт 22)
ufw allow 80/tcp              # HTTP (для Let's Encrypt Traefik)
ufw allow 443/tcp             # HTTPS
ufw enable
```

Порт 3007 не открывать наружу — YouBox доступен только через Traefik (80/443).

### Docker security (уже настроено в docker-compose.yml)

- `no-new-privileges:true` — запрет повышения привилегий
- `cap_drop: ALL` — удаление всех capabilities
- `tmpfs: /tmp` — временные файлы в памяти
- `127.0.0.1:3007:3007` — debug-доступ только с localhost

### Git hygiene

```
.env                    # Секреты (PIN, пути к cookies)
secrets/                # Любые секретные файлы
cookies/                # Cookies файлы
*.cookies.txt           # Cookies файлы
backups/                # Бэкапы БД
/data                   # Локальные данные
```

---

## Бэкапы

### Автоматический ежедневный бэкап

```bash
# Добавьте в crontab -e
0 3 * * * /opt/youbox/deploy/backup.sh /opt/backups/youbox 2>&1 | logger -t youbox-backup
```

### Восстановление

```bash
docker compose stop youbox
docker cp /opt/backups/youbox/youbox_20260101_030000.db youbox:/data/db/youbox.db
docker compose start youbox
```

Подробнее: [docs/OPERATIONS.md](docs/OPERATIONS.md#бэкапы)

---

## Cookies

**Cookies файл — чувствительный секрет.** Храните его вне каталога репозитория.

```bash
# 1. Экспортируйте cookies из браузера (расширение Get cookies.txt LOCALLY)
# 2. Скопируйте на сервер
scp youtube.cookies.txt root@141.136.44.9:/opt/youbox-secrets/youtube.cookies.txt

# 3. На сервере — права (только чтение)
ssh root@141.136.44.9
chmod 644 /opt/youbox-secrets/youtube.cookies.txt

# 4. В .env укажите:
# YT_COOKIES_FILE=/opt/youbox-secrets/youtube.cookies.txt

# 5. Перезапустите
docker compose up -d
```

Полная документация: [docs/COOKIES.md](docs/COOKIES.md)

---

## Troubleshooting

### Контейнер unhealthy

```bash
# Проверка healthcheck
docker inspect youbox --format='{{json .State.Health}}' | python3 -m json.tool

# Логи healthcheck
docker compose logs youbox | grep -i health

# Прямая проверка
docker exec youbox node -e "
const http = require('http');
http.get('http://localhost:3007/api/health', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
"
```

### Traefik не видит YouBox

```bash
# Проверка сети
docker network inspect root_default | grep youbox

# Проверка labels (должны быть)
docker inspect youbox --format='{{json .Config.Labels}}' | python3 -m json.tool

# Логи Traefik
docker logs root-traefik-1 --tail 100 | grep -i youbox
```

### Ошибка certresolver

```bash
# Проверка логов Traefik
docker logs root-traefik-1 --tail 200 | grep -E "certificate|acme|letsencrypt"

# Убедитесь, что certresolver в .env совпадает с конфигурацией Traefik
# TsenTraefik_CERTRESOLVER=mytlschallenge
```

### yt-dlp не работает

```bash
docker exec youbox yt-dlp --version
docker exec youbox ls -la /cookies/
docker exec youbox yt-dlp --js-runtimes node --remote-components ejs:github \
  --cookies /cookies/cookies.txt \
  --dump-json --no-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### База данных повреждена

```bash
docker compose stop youbox
docker cp /opt/backups/youbox/youbox_latest.db youbox:/data/db/youbox.db
docker compose start youbox
```

### Не хватает места

```bash
df -h
du -sh /opt/youbox/data/
docker exec youbox find /data/tmp -type f -mtime +1 -delete
docker system prune -f
```

### NXDOMAIN для домена YouBox

- Проверьте A-запись у DNS-провайдера
- Убедитесь, что `YOUBOX_HOST` в `.env` совпадает с именем в A-записи
- Подождите TTL (300 секунд = 5 минут)
- Проверьте: `dig youbox.example.com +short`

---

## Замеченные инфраструктурные риски

При анализе логов Traefik обнаружены следующие проблемы, **не связанные с YouBox**, но值得 отметить:

| Проблема | Описание |
|----------|----------|
| `router hermes@docker` | Использует несуществующий certresolver `letsencrypt` — другой сервис настроен некорректно |
| `n8n.srv1138367.hstgr.cloud` | NXDOMAIN для A/AAAA — DNS-имя не резолвится, Traefik не может выпустить сертификат |

Эти проблемы не влияют на работу YouBox, но могут свидетельствовать о необходимости аудита других сервисов на том же VPS.
