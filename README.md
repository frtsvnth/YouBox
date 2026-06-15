# YouBox

Приватный загрузчик видео/аудио для семьи. Self-hosted на Next.js 16.

## Запуск

```bash
npm install
cp .env.example .env   # установи APP_PIN_HASH
npm run dev
```

## Стек

- **Next.js 16** (App Router + API routes)
- **TypeScript**
- **Tailwind CSS v4** (CSS-first конфигурация)
- **SQLite** (better-sqlite3)
- **yt-dlp** + **ffmpeg** (внешние бинарники)

## Возможности

- Вставка URL YouTube (видео/плейлист) → показ вариантов качества
- Быстрые пресеты: Best, 1080p, 720p, MP3, M4A
- Advanced mode: таблица всех форматов от yt-dlp
- Фоновые задачи с прогрессом
- История задач с повторным запуском
- Тёмная и светлая тема
- Защита PIN-кодом + lockout от brute-force

Подробнее: `AGENTS.md`
