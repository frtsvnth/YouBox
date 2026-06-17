# YouBox

Приватный загрузчик видео/аудио для семьи. Self-hosted на Next.js 16.

Deploys behind [Traefik](https://traefik.io/traefik/) reverse proxy. Caddy больше не используется.

## Быстрый старт (локальный запуск)

```bash
npm install
cp .env.example .env   # установи APP_PIN_HASH
npm run dev
```

## Развёртывание на VPS

Полная инструкция: [DEPLOY.md](DEPLOY.md)

## Документация

| Документ | О чём |
|----------|-------|
| [DEPLOY.md](DEPLOY.md) | Деплой на VPS за Traefik: Docker, external network, firewall |
| [docs/COOKIES.md](docs/COOKIES.md) | Настройка cookies: upload через UI или browser-сессия на VPS |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Эксплуатация: healthcheck, backup, update, откат |
| [AGENTS.md](AGENTS.md) | Архитектура и структура проекта |

## Стек

- **Next.js 16** (App Router + API routes)
- **TypeScript**
- **Tailwind CSS v4**
- **SQLite** (better-sqlite3)
- **yt-dlp** + **ffmpeg**

## Возможности

- Вставка URL YouTube (видео/плейлист) → показ вариантов качества
- Быстрые пресеты: Best, 1080p, 720p, MP3, M4A
- Advanced mode: таблица всех форматов от yt-dlp
- Фоновые задачи с прогрессом (стадия, проценты, скорость, ETA, объём)
- История задач с повторным запуском и удалением
- Встроенная панель логов (worker, yt-dlp, cleanup) в реальном времени
- Панель настроек: управление источниками cookies, загрузка cookies.txt, браузерная сессия
- Тёмная и светлая тема
- Защита PIN-кодом + lockout от brute-force
- Работа по HTTPS (за Traefik)
- **Cookie Source Management**: загрузка cookies.txt через UI или браузерная сессия на VPS (Chromium sidecar)

## Переменные окружения

| Переменная | Описание |
|-----------|----------|
| `APP_PIN_HASH` | SHA-256 хеш от PIN (обязательно) |
| `YOUBOX_HOST` | Домен для Traefik (обязательно) |
| `TRAEFIK_NETWORK` | Внешняя сеть Traefik (по умолч. `root_default`) |
| `TRAEFIK_ENTRYPOINTS` | Entrypoint Traefik (по умолч. `websecure`) |
| `TRAEFIK_CERTRESOLVER` | CertResolver для Let's Encrypt (по умолч. `mytlschallenge`) |
| `APP_BASE_URL` | Базовый URL для HTTPS (опционально) |
| `COOKIE_SECURE` | `true` для HTTPS (за Traefik), `false` для HTTP |
| `YT_COOKIES_FILE` | Путь к cookies.txt для yt-dlp (legacy, fallback) |
| `DATA_DIR` | Директория данных (по умолч. `./data`) |
| `PORT` | Порт сервера (по умолч. `3007`) |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` |
| `ENABLE_BROWSER_COOKIE_SOURCE` | Включить browser sidecar (`true`/`false`, по умолч. `false`) |
| `BROWSER_COOKIE_SERVICE_URL` | URL browser sidecar (напр. `http://youbox-browser:3808`) |
| `BROWSER_COOKIE_EXPORT_PATH` | Путь для сохранения экспортированных cookies (напр. `/data/cookies/browser-exported.txt`) |
| `DEFAULT_COOKIE_SOURCE` | Источник по умолчанию (`uploaded_file`/`browser_session`) |

## Архитектура деплоя

```
Пользователь → VPS:443 → Traefik → youbox:3007
                              ↑
                       external network: root_default
                       certresolver: mytlschallenge
                       entrypoint: websecure
```
