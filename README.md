# YouBox

Приватный загрузчик видео/аудио для семьи. Self-hosted на Next.js 16.

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
| [DEPLOY.md](DEPLOY.md) | Деплой на VPS: Docker, reverse proxy, firewall |
| [docs/COOKIES.md](docs/COOKIES.md) | Настройка и ротация cookies файла |
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
- Тёмная и светлая тема
- Защита PIN-кодом + lockout от brute-force
