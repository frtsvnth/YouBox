# YouBox — Production Deployment Guide

## Содержание

1. [Требования](#требования)
2. [Быстрый старт (первый деплой)](#быстрый-старт-первый-деплой)
3. [Структура деплоя](#структура-деплоя)
4. [Reverse Proxy (Caddy)](#reverse-proxy-caddy)
5. [Firewall и Безопасность](#firewall-и-безопасность)
6. [Бэкапы](#бэкапы)
7. [Обновление yt-dlp](#обновление-yt-dlp)
8. [Cookies](#cookies)
9. [Runbook](#runbook)
10. [Troubleshooting](#troubleshooting)

---

## Требования

| Компонент | Версия |
|-----------|--------|
| Linux (Ubuntu 22.04+/Debian 12+) | любая |
| Docker | 24+ |
| Docker Compose | v2.24+ |
| Git | опционально |

Проверка:

```bash
docker --version && docker compose version
```

## Быстрый старт (первый деплой)

### 1. Подготовка сервера

```bash
# Подключитесь к VPS
ssh user@your-server-ip

# Установите Docker (если нет)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Выйдите и зайдите снова (или используйте newgrp docker)

# Установите Docker Compose plugin (обычно уже есть с Docker)
```

### 2. Клонирование и настройка

```bash
# Клонируйте репозиторий
git clone <repo-url> /opt/youbox
cd /opt/youbox

# Настройте .env
cp .env.example .env
nano .env
```

**Обязательно измените:**

```bash
# Сгенерируйте свой PIN:
echo -n "твой-секретный-пин" | shasum -a 256 | cut -d' ' -f1
# Вставьте результат в APP_PIN_HASH в .env
```

### 3. Запуск

```bash
# Production запуск
sudo ./deploy/deploy.sh

# Проверка
docker compose ps
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

## Структура деплоя

```
/opt/youbox/
├── docker-compose.yml      # Оркестрация сервисов
├── Dockerfile              # Production-образ
├── .env                    # Конфигурация (не в git!)
├── .env.example            # Шаблон конфигурации
├── Caddyfile               # Reverse proxy конфиг (опционально)
├── healthcheck.sh          # Docker HEALTHCHECK
├── deploy/
│   ├── deploy.sh           # Первый деплой / обновление / откат
│   ├── backup.sh           # Бэкап SQLite + метаданных
│   ├── update-yt-dlp.sh    # Обновление yt-dlp в контейнере
│   └── rotate-cookies.sh   # Ротация cookies файла
├── data/                   # Данные (volume)
│   ├── db/youbox.db        # SQLite (WAL mode)
│   ├── downloads/          # Готовые файлы
│   └── tmp/                # Временные файлы загрузок
└── backups/                # Бэкапы (создаётся автоматически)
```

### Volumes (docker-compose)

| Volume | Путь в контейнере | Назначение |
|--------|-------------------|------------|
| `youbox_data` | `/data` | SQLite + downloads + tmp |
| `cookies` | `/cookies/cookies.txt:ro` | Cookies файл (read-only) |

## Reverse Proxy (Caddy)

### Вариант 1: Caddy в Docker Compose

1. Раскомментируйте сервис `caddy` в `docker-compose.yml`
2. Настройте `Caddyfile`:
   - Замените `youbox.example.com` на ваш домен
   - Убедитесь, что DNS A-запись указывает на ваш VPS
3. Запустите:

```bash
docker compose up -d
```

### Вариант 2: Caddy на хосте

```caddyfile
youbox.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    header / {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}
```

### Вариант 3: Nginx на хосте

```nginx
server {
    listen 443 ssl http2;
    server_name youbox.example.com;

    ssl_certificate /etc/letsencrypt/live/youbox.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/youbox.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        client_max_body_size 50M;
    }
}

server {
    listen 80;
    server_name youbox.example.com;
    return 301 https://$server_name$request_uri;
}
```

## Firewall и Безопасность

### 1. UFW (Ubuntu)

```bash
# Базовые правила
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh                 # SSH (порт 22)
ufw allow 80/tcp              # HTTP (для Let's Encrypt)
ufw allow 443/tcp             # HTTPS
ufw enable
```

### 2. Доступ только через Tailscale (рекомендуется)

```bash
# Установите Tailscale на VPS и клиент
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Закройте публичный доступ к портам
ufw deny 80/tcp
ufw deny 443/tcp
# Откройте только SSH и Tailscale (по умолчанию UDP 41641)
ufw allow ssh

# Используйте Tailscale IP или MagicDNS для доступа
# В docker-compose порты привязаны к 127.0.0.1 — это безопасно
```

### 3. fail2ban

```bash
apt-get install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
```

### 4. Docker security

- `no-new-privileges:true` — запрещает повышение привилегий
- `cap_drop: ALL` — удаляет все capabilities
- `read_only: true` — корневая ФС только для чтения
- `tmpfs: /tmp` — временные файлы в памяти
- `ports: 127.0.0.1:3000:3000` — сервис не торчит наружу

### 5. IP Allowlist (Caddy)

```caddyfile
youbox.example.com {
    @blocked {
        not remote_ip {
            # Разрешённые IP/подсети
            192.168.1.0/24
            10.0.0.0/8
            # Tailscale subnet
            100.64.0.0/10
        }
    }
    respond @blocked "Access Denied" 403

    reverse_proxy youbox:3000
}
```

## Бэкапы

### Автоматический ежедневный бэкап

```bash
# Добавьте в crontab -e
0 3 * * * /opt/youbox/deploy/backup.sh /opt/backups/youbox 2>&1 | logger -t youbox-backup
```

### Что бэкапится

| Файл | Описание |
|------|----------|
| `youbox_YYYYMMDD_HHMMSS.db` | SQLite (WAL-safe через `.backup`) |
| `jobs_YYYYMMDD_HHMMSS.json` | Метаданные всех задач (JSON) |
| `downloads_manifest_*.txt` | Список файлов в downloads |

### Восстановление

```bash
# Остановите контейнер
docker compose stop youbox

# Восстановите БД
docker cp /opt/backups/youbox/youbox_20260101_030000.db youbox:/data/db/youbox.db

# Запустите
docker compose start youbox
```

## Обновление yt-dlp

yt-dlp обновляется часто (под новые сайты и фиксы). Обновляйте его независимо от апдейта приложения:

```bash
# Без перезапуска
./deploy/update-yt-dlp.sh

# С перезапуском контейнера
./deploy/update-yt-dlp.sh --restart
```

Или вручную:

```bash
docker exec youbox pip install --break-system-packages -U yt-dlp
docker exec youbox yt-dlp --version
```

## Cookies

### Первая настройка

1. Экспортируйте cookies из браузера (расширение: Get cookies.txt LOCALLY)
2. Скопируйте на сервер:

```bash
scp cookies.txt user@server:/opt/youbox/data/cookies.txt
chmod 600 /opt/youbox/data/cookies.txt
```

3. Укажите путь в `.env`:

```env
YT_COOKIES_FILE=/opt/youbox/data/cookies.txt
```

4. Перезапустите:

```bash
docker compose up -d
```

### Ротация (обновление cookies)

```bash
# Если cookies истекли:
# 1. Экспортируйте свежие cookies из браузера
# 2. Скопируйте на сервер
scp fresh_cookies.txt user@server:/tmp/

# 3. Запустите ротацию на сервере
/opt/youbox/deploy/rotate-cookies.sh /tmp/fresh_cookies.txt
```

Контейнер подхватит новый файл автоматически при следующем запросе к yt-dlp. Перезапуск не нужен.

### Если cookies файл отсутствует

- Приложение продолжает работать
- `/api/health` вернёт `status: "degraded"` (не `"error"`)
- yt-dlp будет работать без cookies (возможны ограничения доступа)
- HEALTHCHECK контейнера НЕ упадёт (degraded != error)

## Runbook

### Первый деплой

```bash
# 1. Подготовка сервера
ssh user@vps-ip
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit

# 2. Клонирование
ssh user@vps-ip
git clone <repo> /opt/youbox
cd /opt/youbox
cp .env.example .env
nano .env  # установите APP_PIN_HASH

# 3. Запуск
sudo ./deploy/deploy.sh
```

### Обновление приложения

```bash
cd /opt/youbox

# 1. Бэкап
./deploy/backup.sh

# 2. Обновление (git pull + пересборка)
./deploy/deploy.sh --update
# или вручную:
git pull
docker compose build --pull
docker compose up -d --force-recreate
docker image prune -f
```

### Откат

```bash
cd /opt/youbox
./deploy/deploy.sh --rollback
# или вручную:
docker compose up -d --force-recreate
```

### Полный ребут сервера

```bash
# После перезагрузки сервера
cd /opt/youbox
docker compose up -d
# Docker Compose с restart: unless-stopped запустится автоматически,
# если Docker daemon настроен на автозапуск:
sudo systemctl enable docker
```

## Troubleshooting

### Контейнер не запускается

```bash
# Логи
docker compose logs youbox

# Проверка .env
docker compose config

# Проверка HEALTHCHECK
docker inspect --format='{{json .State.Health}}' youbox
```

### yt-dlp не работает

```bash
# Проверка версии
docker exec youbox yt-dlp --version

# Проверка cookies
docker exec youbox ls -la /cookies/

# Тестовый запуск (изолированно)
docker exec youbox yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### База данных повреждена

```bash
# Восстановление из бэкапа
docker compose stop youbox
docker cp /opt/backups/youbox/youbox_latest.db youbox:/data/db/youbox.db
docker compose start youbox

# Если нет бэкапа — попробуйте восстановить WAL:
docker exec youbox sh -c "sqlite3 /data/db/youbox.db '.recover' | sqlite3 /data/db/youbox_recovered.db"
docker exec youbox mv /data/db/youbox.db /data/db/youbox_corrupted.db
docker exec youbox mv /data/db/youbox_recovered.db /data/db/youbox.db
```

### Не хватает места на диске

```bash
# Проверка
df -h
du -sh /opt/youbox/data/

# Очистка временных файлов вручную
docker exec youbox find /data/tmp -type f -mtime +1 -delete

# Очистка Docker
docker system prune -f

# Уменьшите FILE_TTL в .env (по умолчанию 7200 = 2 часа)
```
