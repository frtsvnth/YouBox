# YouBox — Архитектура проекта

Язык проекта: **русский**. Весь код, комментарии и документация ведутся на русском.

## 1. Обзор архитектуры

```
┌──────────────┐     ┌──────────────────────────────────────────────┐     ┌──────────────┐
│   Браузер    │────▶│          Next.js App (port 3007)              │────▶│   SQLite     │
│  (Frontend)  │     │                                                │     │  (youbox.db) │
└──────────────┘     │  ┌──────────┐  ┌───────────────────────────┐  │     └──────────────┘
                      │  │ Auth     │  │  API Routes              │  │
                      │  │ Proxy    │  │  /api/auth/*              │  │
                      │  │          │  │  /api/extract             │  │
                      │  └──────────┘  │  /api/jobs/*              │  │
                      │               │  /api/download/*           │  │
                      │               │  /api/health               │  │
                      │               │  /api/cleanup              │  │
                      │               └───────────────────────────┘  │
                      │                                               │
                      │  ┌────────────────────────────────────────┐  │
                      │  │  Фоновый воркер (worker)               │  │
                      │  │  yt-dlp (extract/download) + ffmpeg    │  │
                      │  │  безопасный subprocess adapter         │  │
                      │  └────────────────────────────────────────┘  │
                      └──────────────────────────────────────────────┘
                                        │
                               ┌────────┴────────┐
                               │  /data/downloads │
                               │  /data/tmp       │
                               │  /data/db        │
                               └─────────────────┘
```

### Ключевые архитектурные решения (ADR)

**ADR-1: Next.js App Router с API routes вместо отдельного бэкенда**
- Контекст: Минимизация сложности деплоя для домашнего сервиса на одном VPS
- Решение: API routes Next.js как бэкенд; один процесс обслуживает и UI, и API
- Следствие: Простой деплой, один Docker-образ, один порт. Фоновые задачи работают в том же контейнере через setInterval-воркер.

**ADR-2: SQLite через better-sqlite3 вместо PostgreSQL**
- Контекст: Сервис для 1-5 пользователей, нет конкурентной записи
- Решение: SQLite с WAL-режимом. better-sqlite3 синхронный — код проще, нет пула соединений
- Следствие: Нулевая инфраструктура. Файл БД сохраняется через Docker volume.

**ADR-3: Polling на фронтенде вместо WebSockets**
- Контекст: Использование семьёй — низкая частота, не нужна реальная即时ность
- Решение: Фронтенд опрашивает `/api/jobs` каждые 2 секунды для активных задач
- Следствие: Проще код, нет WebSocket-инфраструктуры, <1% нагрузки на CPU

**ADR-4: Session-based auth с HTTP-only cookie вместо JWT**
- Контекст: PIN общий для семьи, нет индивидуальных учёток
- Решение: Сервер генерирует UUID сессии, хранит в SQLite `sessions`, кука ставится при логине
- Следствие: Можно отозвать сессию, токен не доступен из JS, простая реализация

**ADR-5: yt-dlp как внешний бинарник вместо JavaScript-библиотеки**
- Контекст: yt-dlp — стандарт индустрии, часто обновляется, поддерживает 1000+ сайтов
- Решение: Запуск через безопасный subprocess adapter (`shell: false`). Версия управляется через Dockerfile
- Следствие: Зависимость от внешнего бинарника; Docker инкапсулирует это

**ADR-6: Фоновый воркер на setInterval в том же процессе вместо Redis/Bull**
- Контекст: Один VPS, один контейнер, горизонтальное масштабирование не нужно
- Решение: Внутрипроцессный воркер, опрашивающий таблицу `jobs` каждые 3 секунды
- Следствие: Нет зависимости от Redis. При перезапуске процесса задачи в очереди возобновляются

**ADR-7: APP_PIN_HASH вместо plaintext PIN в ENV**
- Контекст: Безопасность — PIN не должен храниться в plaintext нигде
- Решение: В ENV кладётся SHA-256 хеш PIN. Сервер сравнивает `hash(provided) === stored_hash` через `timingSafeEqual`
- Следствие: Даже при утечке .env файла PIN не раскрыт

**ADR-8: Lockout после N неудачных попыток входа**
- Контекст: Защита от brute-force атаки на login endpoint
- Решение: Таблица `login_attempts` в SQLite. После N неудач — блокировка на T секунд
- Следствие: Дополнительная защита, персистентность после перезапуска

## 2. Модель данных

### Схема SQLite (v4)

```sql
-- Миграции через user_version pragma
-- v1: базовая схема
-- v2: login_attempts, mode, playlist_index, playlist_size
-- v3: format_id
-- v4: progress_downloaded, progress_total, progress_speed, progress_eta, current_stage

-- Таблица сессий
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

-- Таблица задач
CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  format        TEXT NOT NULL DEFAULT 'mp4',
  mode          TEXT NOT NULL DEFAULT 'video',        -- video | audio | playlist
  status        TEXT NOT NULL DEFAULT 'created'
                CHECK(status IN ('created','extracting','queued','downloading','muxing','ready','failed','expired')),
  title         TEXT,
  filename      TEXT,
  filesize      INTEGER,
  error_message TEXT,
  progress      REAL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  ready_at      INTEGER,
  expires_at    INTEGER,
  playlist_index INTEGER,
  playlist_size  INTEGER,
  format_id     TEXT,                                 -- выбранный формат из списка
  progress_downloaded INTEGER,                        -- скачано байт
  progress_total      INTEGER,                        -- всего байт
  progress_speed      REAL,                           -- скорость (байт/с)
  progress_eta        INTEGER,                        -- ETA (секунд)
  current_stage       TEXT DEFAULT ''                 -- текущая стадия (extracting/downloading/muxing)
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Таблица для lockout
CREATE TABLE login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_login_attempts_at ON login_attempts(attempted_at);
```

### Жизненный цикл задачи

```
created ──► extracting ──► queued ──► downloading ──► ready ──► expired
                                                               │
                                                               └──► failed
```

- `created`: URL отправлен, ещё не обработан
- `extracting`: yt-dlp --dump-json получает метаданные
- `queued`: Метаданные получены, ждёт очереди на скачивание
- `downloading`: yt-dlp скачивает файл
- `ready`: Файл доступен для скачивания
- `failed`: Произошла ошибка
- `expired`: TTL истёк, файл удалён

## 3. Контракт API

### POST /api/auth/login
Тело: `{ pin: "123456" }`
Ответ 200: `{ ok: true }` + заголовок Set-Cookie
Ответ 400: `{ error, code: "VALIDATION_ERROR", remainingAttempts }`
Ответ 401: `{ ok: false, remainingAttempts, lockoutUntil }`
Ответ 429: `{ error, code: "RATE_LIMIT_ERROR" }` (по IP) или `{ error, code: "LOCKOUT_ERROR" }`
- Rate limit: 10 запросов/мин с одного IP
- Lockout: LOGIN_MAX_ATTEMPTS неудач → блокировка на LOGIN_LOCKOUT_DURATION секунд

### POST /api/auth/logout
Ответ 200: `{ ok: true }` + очистка cookie

### GET /api/auth/session
Ответ 200: `{ authenticated: true, sessionId?, createdAt?, expiresAt? }`
Ответ 200: `{ authenticated: false }` (без куки или истекла)

### POST /api/extract
Тело: `{ url: string }`
Ответ 200: `{ metadata: ExtractedMetadata }`
Ответ 401: не авторизован
- Rate limit: 10 запросов/мин на сессию
- Извлекает: заголовок, длительность, список форматов, информацию о плейлисте

```typescript
interface ExtractedMetadata {
  id: string
  title: string
  duration: number | null
  webpage_url: string
  thumbnail: string | null
  uploader: string | null
  formats: FormatInfo[]         // все доступные форматы
  is_playlist: boolean
  playlist_count: number | null
  entries: ExtractedEntry[] | null
  extractor: string
  extractor_key: string
}

interface FormatInfo {
  format_id: string
  ext: string
  resolution: string | null
  filesize: number | null
  format_note: string | null
  vcodec: string
  acodec: string
  fps: number | null
  tbr: number | null
}
```

### POST /api/jobs
Тело: `{ url, format?: "mp4"|"mp3"|"webm", mode?: "video"|"audio"|"playlist", format_id?: string }`
Ответ 201: `{ id, status: "created" }`
Ошибки: 400 (неверный URL), 401 (не авторизован), 409 (дубликат), 429 (rate limit)

### GET /api/jobs
Параметры: `?status=active|all` (по умолчанию: active)
Ответ 200: `{ jobs: Job[] }`

### GET /api/jobs/:id
Ответ 200: `{ job: Job }`
Ответ 404: `{ error, code: "NOT_FOUND" }`

### POST /api/jobs/:id/cancel
Ответ 200: `{ ok: true }` (только для queued/downloading)

### POST /api/jobs/:id/retry
Ответ 200: `{ ok: true }` (только для failed/expired)

### POST /api/jobs/:id/delete
Ответ 200: `{ ok: true }` (удаление записи из БД + файлов tmp/downloads)

### GET /api/download/:id
Ответ 200: Файловый поток с Content-Disposition (UTF-8 filename encoding)
Ответ 404: `{ error, code: "NOT_FOUND" }` или `{ error, code: "FILE_NOT_FOUND" }`

### GET /api/logs?after=N
Ответ 200: `{ logs: LogEntry[], total: number, nextId: number }` (порционный polling)
### POST /api/logs
Ответ 200: `{ ok: true }` (очистка буфера логов)

### GET /api/health (публичный)
Ответ 200: `{ status: "ok"|"degraded", app, ytDlp, ffmpeg, cookiesFile, database }`
Ответ 503: `{ status: "error", ... }`
- Проверяет: доступность yt-dlp, ffmpeg, БД, cookies file (если указан)

### POST /api/cleanup
Ответ 200: `{ deleted: number }`

## 4. Проектирование фоновых задач

### Цикл воркера (внутри процесса, каждые 3 секунды)

```
1. SELECT * FROM jobs WHERE status = 'created' LIMIT 1
   → Статус='extracting', запуск extractMetadata()
   → Успех: сохранить title, статус='queued'
   → Ошибка: статус='failed', user-friendly error_message

2. SELECT * FROM jobs WHERE status = 'queued' LIMIT 1
   → Статус='downloading', запуск downloadFile()
   → Прогресс пишется в БД по мере получения из stderr yt-dlp
   → Успех: файл перемещён в downloads/, статус='ready'
   → Ошибка: статус='failed', user-friendly error_message

3. Очистка:
   - expired files → удаление с диска, статус='expired'
   - stale jobs (extracting/downloading >5мин) → статус='failed'
   - expired sessions → DELETE
```

### Конкуренция
- Флаг `isProcessing` предотвращает параллельную обработку
- Только 1 задача одновременно (yt-dlp + ffmpeg тяжелы для маленького VPS)
- Глубина очереди не ограничена (последовательная обработка)

### Хранение файлов
```
/data/
├── downloads/
│   └── {job_id}.{ext}     -- готовые файлы
├── tmp/
│   └── {job_id}/          -- рабочая директория для задачи
└── db/
    └── youbox.db          -- SQLite база данных
```

## 5. Модель безопасности

1. **Хеширование PIN**: SHA-256 с `timingSafeEqual`. Сравнивается `hash(provided) === APP_PIN_HASH` (из ENV). Plaintext PIN нигде не хранится. Для генерации: `echo -n "123456" | shasum -a 256 | cut -d' ' -f1`
2. **Lockout**: После LOGIN_MAX_ATTEMPTS (5) неудачных попыток — блокировка на LOGIN_LOCKOUT_DURATION (300с). Данные в SQLite, переживают перезапуск.
3. **Сессии**: UUID v4, хранится в таблице `sessions` с expiry. Кука: HTTP-only, SameSite=Lax, Secure (в проде), Path=/
4. **Проверка сессии**: Proxy (Next.js 16) проверяет наличие куки на всех `/api/*` и страницах, кроме публичных. API routes дополнительно валидируют сессию в БД.
5. **Rate limiting**: In-memory лимитер на:
   - POST /api/auth/login — 10/мин по IP
   - POST /api/extract — 10/мин на сессию
   - POST /api/jobs — 5/мин на сессию
6. **Subprocess safety**: Все вызовы через `subprocess.ts` с `shell: false`. Чувствительные аргументы (--cookies) не логируются.
7. **Защита скачивания**: `/api/download/:id` проверяет сессию + что задача в статусе `ready`
8. **Валидация URL**: Проверка парсинга URL + yt-dlp валидирует на уровне HTTP
9. **Очистка**: Автоматическая по TTL в цикле воркера. Ручной запуск через `POST /api/cleanup`

### ENV-контракт

```env
# Обязательные
APP_PIN_HASH=...             # SHA-256 хеш от PIN (рекомендуется)
DATA_DIR=/data               # Директория для данных

# Сессии
SESSION_TTL=86400            # Время жизни сессии (секунды, 24ч)

# Файлы
FILE_TTL=7200                # Время жизни файла после готовности (2ч)

# Безопасность
LOGIN_MAX_ATTEMPTS=5         # Макс. неудачных попыток входа
LOGIN_LOCKOUT_DURATION=300   # Блокировка (секунды, 5мин)

# yt-dlp
YT_COOKIES_FILE=             # Путь к cookies.txt
PLAYLIST_MAX_ITEMS=10        # Максимум элементов плейлиста

# Сервер
PORT=3007

# Логирование
LOG_LEVEL=info               # debug | info | warn | error
```

## 6. Структура папок

```
youbox/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── session/route.ts
│   │   │   ├── extract/route.ts
│   │   │   ├── jobs/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/route.ts
│   │   │   │   ├── [id]/cancel/route.ts
│   │   │   │   ├── [id]/retry/route.ts
│   │   │   │   └── [id]/delete/route.ts
│   │   │   ├── download/[id]/route.ts
│   │   │   ├── logs/route.ts
│   │   │   ├── health/route.ts
│   │   │   └── cleanup/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Badge.tsx          # 6 variants
│   │   │   ├── Button.tsx         # 4 variants + spinner
│   │   │   ├── Card.tsx           # border + hover
│   │   │   ├── Drawer.tsx         # slideover с overlay
│   │   │   ├── EmptyState.tsx     # 5 иконок
│   │   │   ├── Input.tsx          # label/error/hint
│   │   │   ├── Modal.tsx          # центрированный overlay
│   │   │   ├── ProgressBar.tsx    # aria-progressbar
│   │   │   └── Spinner.tsx        # PageSpinner, InlineSpinner
│   │   ├── ContentCard.tsx        # Карточка контента
│   │   ├── ConfirmDialog.tsx      # Модальное подтверждение
│   │   ├── FormatTable.tsx        # Таблица форматов
│   │   ├── HistoryPanel.tsx       # Drawer истории
│   │   ├── JobCard.tsx            # Карточка задачи
│   │   ├── JobDetailsDrawer.tsx   # Drawer деталей
│   │   ├── JobList.tsx            # Polling-список
│   │   ├── LogPanel.tsx           # Drawer логов
│   │   ├── LoginForm.tsx          # Форма входа
│   │   ├── PinInput.tsx           # 6 полей PIN
│   │   ├── PlaylistConfirmDialog.tsx
│   │   ├── ThemeToggle.tsx        # dark/light
│   │   └── URLBar.tsx             # URL input
│   ├── lib/
│   │   ├── db.ts           # SQLite + миграции (v1-v4)
│   │   ├── auth.ts         # APP_PIN_HASH, сессии, timingSafeEqual
│   │   ├── lockout.ts      # Lockout после неудачных попыток
│   │   ├── worker.ts       # Фоновый воркер
│   │   ├── downloader.ts   # yt-dlp: extract + download + playlist + cookies
│   │   ├── muxer.ts        # ffmpeg обёртка
│   │   ├── cleanup.ts      # Очистка файлов по TTL
│   │   ├── errors.ts       # Типизированные ошибки + user-friendly messages
│   │   ├── logger.ts       # In-memory кольцевой буфер логов (globalThis)
│   │   ├── subprocess.ts   # Безопасный subprocess adapter
│   │   ├── rate-limit.ts   # In-memory rate limiter
│   │   ├── health.ts       # Health check service
│   │   └── env.ts          # Валидация ENV
│   │   └── theme-context.tsx # React Context для темы
│   ├── proxy.ts             # Auth proxy (Next.js 16)
│   └── instrumentation.ts   # Запуск воркера при старте
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── next.config.ts
└── .env.example
```

## 7. Docker-стратегия

### Dockerfile
- Multi-stage: базовый образ `node:22-slim`
- Установка yt-dlp (pip) и ffmpeg (apt) на том же этапе
- Копирование standalone-сборки Next.js
- Запуск: `node server.js`

### docker-compose.yml
```yaml
services:
  youbox:
    build: .
    ports:
      - "${PORT:-3007}:3007"
    environment:
      - APP_PIN_HASH=${APP_PIN_HASH}
      - DATA_DIR=/data
      - SESSION_TTL=${SESSION_TTL:-86400}
      - FILE_TTL=${FILE_TTL:-7200}
      - LOGIN_MAX_ATTEMPTS=${LOGIN_MAX_ATTEMPTS:-5}
      - LOGIN_LOCKOUT_DURATION=${LOGIN_LOCKOUT_DURATION:-300}
      - YT_COOKIES_FILE=${YT_COOKIES_FILE:-}
      - PLAYLIST_MAX_ITEMS=${PLAYLIST_MAX_ITEMS:-10}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - NODE_ENV=production
    volumes:
      - youbox_data:/data
    restart: unless-stopped

volumes:
  youbox_data:
```

### Процесс деплоя
1. `git push` на VPS
2. `docker compose up -d --build` на VPS
3. Данные сохраняются в named volume
