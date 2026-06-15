# YouBox — Production Deployment Guide

## Содержание

1. [Требования](#требования)
2. [Сценарии деплоя](#сценарии-деплоя)
   - [Public GitHub репозиторий (HTTPS)](#public-github-репозиторий-https)
   - [Приватный репозиторий (SSH deploy key)](#приватный-репозиторий-ssh-deploy-key)
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

---

## Сценарии деплоя

### Public GitHub репозиторий (HTTPS)

```bash
# 1. Подготовка сервера
ssh user@your-server-ip
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit  # выйти и зайти снова (или: newgrp docker)

# 2. Клонирование публичного репозитория
ssh user@your-server-ip
sudo git clone https://github.com/ВАШ_НИК/youbox.git /opt/youbox
sudo chown -R $USER:$USER /opt/youbox
cd /opt/youbox

# 3. Настройка .env
cp .env.example .env
nano .env
```

**Обязательно измените APP_PIN_HASH:**
```bash
echo -n "твой-секретный-пин-код" | shasum -a 256 | cut -d' ' -f1
# Вставьте результат в .env
```

```bash
# 4. Запуск
./deploy/deploy.sh

# 5. Проверка
docker compose ps
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

### Приватный репозиторий (SSH deploy key)

```bash
# 1. Подготовка сервера (аналогично public)
ssh user@your-server-ip
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit

# 2. Настройка SSH deploy key
ssh user@your-server-ip
ssh-keygen -t ed25519 -f ~/.ssh/youbox_deploy -N ""
cat ~/.ssh/youbox_deploy.pub
# Добавьте этот ключ в GitHub: Settings > Deploy keys > Add deploy key
# (требуется доступ на чтение)

# 3. Настройка SSH для GitHub
cat > ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  IdentityFile ~/.ssh/youbox_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# 4. Клонирование приватного репозитория
ssh-keyscan github.com >> ~/.ssh/known_hosts
git clone git@github.com:ВАШ_НИК/youbox.git /opt/youbox
cd /opt/youbox

# 5. Настройка .env и запуск
cp .env.example .env
nano .env  # установите APP_PIN_HASH
./deploy/deploy.sh
```

---

## Структура деплоя

```
/opt/youbox/
├── docker-compose.yml      # Оркестрация сервисов
├── Dockerfile              # Production-образ
├── .env                    # Конфигурация (НЕ КОММИТИТЬ!)
├── .env.example            # Шаблон конфигурации
├── Caddyfile               # Reverse proxy (опционально)
├── healthcheck.sh          # Docker HEALTHCHECK
├── deploy/
│   ├── deploy.sh           # Первый деплой / обновление / откат
│   ├── backup.sh           # Бэкап SQLite + метаданных
│   ├── update-yt-dlp.sh    # Обновление yt-dlp в контейнере
│   └── rotate-cookies.sh   # Ротация cookies файла
├── data/                   # Данные (volume Docker)
│   ├── db/youbox.db        # SQLite (WAL mode)
│   ├── downloads/          # Готовые файлы
│   └── tmp/                # Временные файлы загрузок
├── docs/                   # Документация
│   ├── COOKIES.md          # Работа с cookies
│   └── OPERATIONS.md       # Эксплуатация
└── backups/                # Бэкапы (создаётся автоматически)
```

### Secrets (безопасное хранение)

```
/opt/youbox-secrets/        # Вне каталога репозитория!
└── youtube.cookies.txt     # Cookies файл (chmod 600)
```

Подробнее: [docs/COOKIES.md](docs/COOKIES.md)

---

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

---

## Firewall и Безопасность

### 1. UFW (Ubuntu)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh                 # SSH (порт 22)
ufw allow 80/tcp              # HTTP (для Let's Encrypt)
ufw allow 443/tcp             # HTTPS
ufw enable
```

### 2. Доступ только через Tailscale (рекомендуется)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Закройте публичный доступ
ufw deny 80/tcp
ufw deny 443/tcp
ufw allow ssh
ufw allow 41641/udp  # Tailscale

# Используйте Tailscale IP или MagicDNS для доступа
```

### 3. fail2ban

```bash
sudo apt-get install fail2ban

# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 3
bantime = 3600
```

### 4. Docker security (уже настроено)

- `no-new-privileges:true` — запрет повышения привилегий
- `cap_drop: ALL` — удаление всех capabilities
- `read_only: true` — корневая ФС только для чтения
- `tmpfs: /tmp` — временные файлы в памяти
- `ports: 127.0.0.1:3000:3000` — сервис не торчит наружу

### 5. IP Allowlist (Caddy)

```caddyfile
youbox.example.com {
    @blocked {
        not remote_ip {
            10.0.0.0/8          # Внутренняя сеть
            100.64.0.0/10       # Tailscale
        }
    }
    respond @blocked "Access Denied" 403

    reverse_proxy youbox:3000
}
```

### 6. Git hygiene: что НЕ должно попасть в репозиторий

```
.env                    # Секреты (PIN, пути к cookies)
secrets/                # Любые секретные файлы
cookies/                # Cookies файлы
*.cookies.txt           # Cookies файлы
backups/                # Бэкапы БД
/data                   # Локальные данные
```

Эти паттерны добавлены в `.gitignore`. **Перед первым коммитом проверьте:**

```bash
git status              # .env НЕ должно быть в списке
git add --dry-run .     # Проверка что пойдёт в коммит
```

> **Если .env уже был закоммичен ранее — смените PIN и считайте cookies скомпрометированными.**

---

## Бэкапы

### Автоматический ежедневный бэкап

```bash
# Добавьте в crontab -e
0 3 * * * /opt/youbox/deploy/backup.sh /opt/backups/youbox 2>&1 | logger -t youbox-backup
```

### Что бэкапится

| Файл | Описание |
|------|----------|
| `youbox_YYYYMMDD_HHMMSS.db` | SQLite (WAL-safe) |
| `jobs_YYYYMMDD_HHMMSS.json` | Метаданные всех задач |
| `downloads_manifest_*.txt` | Список файлов в downloads |

### Восстановление

```bash
docker compose stop youbox
docker cp /opt/backups/youbox/youbox_20260101_030000.db youbox:/data/db/youbox.db
docker compose start youbox
```

Подробнее: [docs/OPERATIONS.md](docs/OPERATIONS.md#бэкапы)

---

## Обновление yt-dlp

```bash
./deploy/update-yt-dlp.sh          # без перезапуска
./deploy/update-yt-dlp.sh --restart # с перезапуском
```

Вручную:
```bash
docker exec youbox pip install --break-system-packages -U yt-dlp
docker exec youbox yt-dlp --version
```

---

## Cookies

**Cookies файл — чувствительный секрет.** Храните его вне каталога репозитория.

Краткая инструкция:

```bash
# 1. Экспортируйте cookies из браузера (расширение Get cookies.txt LOCALLY)
# 2. Скопируйте на сервер
scp youtube.cookies.txt user@server:/opt/youbox-secrets/youtube.cookies.txt

# 3. На сервере — права
ssh user@server
chmod 600 /opt/youbox-secrets/youtube.cookies.txt

# 4. В .env укажите:
# YT_COOKIES_FILE=/opt/youbox-secrets/youtube.cookies.txt

# 5. Перезапустите
docker compose up -d
```

Полная документация: [docs/COOKIES.md](docs/COOKIES.md)

---

## Runbook

### Первый деплой

```bash
# Подготовка сервера → см. "Сценарии деплоя" выше
# После клонирования и настройки .env:

/opt/youbox/deploy/deploy.sh
```

### Обновление приложения

```bash
cd /opt/youbox
./deploy/backup.sh                     # 1. Бэкап
./deploy/deploy.sh --update            # 2. Обновление
```

### Откат

```bash
cd /opt/youbox
./deploy/deploy.sh --rollback
# или вручную:
git checkout HEAD~1                    # откат кода
docker compose build
docker compose up -d --force-recreate
```

### Полный ребут сервера

Контейнер запустится автоматически (restart: unless-stopped) если Docker запущен:

```bash
sudo systemctl enable docker           # однократно
sudo reboot
```

---

## Troubleshooting

### Контейнер не запускается

```bash
docker compose logs youbox
docker compose config                  # проверка .env
docker inspect --format='{{json .State.Health}}' youbox
```

### yt-dlp не работает

```bash
docker exec youbox yt-dlp --version
docker exec youbox ls -la /cookies/
docker exec youbox yt-dlp --dump-json --no-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### База данных повреждена

```bash
docker compose stop youbox
# Восстановление из бэкапа:
docker cp /opt/backups/youbox/youbox_latest.db youbox:/data/db/youbox.db
docker compose start youbox

# Без бэкапа — recovery через sqlite3:
docker exec youbox sh -c "sqlite3 /data/db/youbox.db '.recover' | sqlite3 /data/db/youbox_recovered.db"
docker exec youbox mv /data/db/youbox.db /data/db/youbox_corrupted.db
docker exec youbox mv /data/db/youbox_recovered.db /data/db/youbox.db
```

### Не хватает места

```bash
df -h
du -sh /opt/youbox/data/
docker exec youbox find /data/tmp -type f -mtime +1 -delete
docker system prune -f
# Уменьшите FILE_TTL в .env (по умолчанию 7200 = 2ч)
```

### Healthcheck показывает degraded

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Проверьте cookiesFile.available, ytDlp.available, ffmpeg.available
```

Подробнее: [docs/OPERATIONS.md](docs/OPERATIONS.md#healthcheck)
