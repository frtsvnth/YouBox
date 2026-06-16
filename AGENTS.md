# YouBox — Приватный загрузчик видео/аудио

Язык проекта: **русский**. Код, комментарии к коммитам, документация — всё на русском.

## Стек
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- SQLite (better-sqlite3)
- yt-dlp + ffmpeg (внешние бинарники)

## Команды

```bash
npm run dev      # Сервер разработки
npm run build    # Production-сборка
npm start        # Запуск production-сервера
npm run lint     # ESLint
npm run typecheck # TypeScript проверка
```

## ENV

```env
# === Обязательные ===
# SHA-256 хеш от PIN (рекомендуется) или сам PIN
# Сгенерировать: echo -n "123456" | shasum -a 256 | cut -d' ' -f1
APP_PIN_HASH=8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
DATA_DIR=./data

# === Сессии ===
SESSION_TTL=86400          # Время жизни сессии (секунды, 24ч)

# === Файлы ===
FILE_TTL=7200              # Время жизни готового файла (секунды, 2ч)

# === Безопасность ===
LOGIN_MAX_ATTEMPTS=5       # Максимум неудачных попыток входа
LOGIN_LOCKOUT_DURATION=300 # Блокировка после превышения (секунды, 5мин)

# === yt-dlp ===
YT_COOKIES_FILE=           # Путь к cookies.txt файлу (опционально)
PLAYLIST_MAX_ITEMS=10      # Максимум элементов плейлиста

# === Сервер ===
PORT=3007

# === Логирование ===
LOG_LEVEL=info             # debug | info | warn | error
```

## Структура проекта

```
src/
├── app/
│   ├── globals.css                    # Дизайн-система: theme tokens, dark/light, анимации (indeterminate, fresh-ready)
│   ├── layout.tsx                     # Root layout
│   ├── (auth)/login/page.tsx          # Страница входа (client, ThemeProvider)
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # SSR auth guard (cookie check)
│   │   └── page.tsx                   # Главная панель (client, вся интеграция)
│   ├── api/auth/
│   │   ├── login/route.ts             # POST /api/auth/login (+rate limit+lockout)
│   │   ├── logout/route.ts            # POST /api/auth/logout
│   │   └── session/route.ts           # GET /api/auth/session
│   ├── api/extract/route.ts           # POST /api/extract (метаданные+форматы)
│   ├── api/jobs/
│   │   ├── route.ts                   # GET/POST /api/jobs
│   │   ├── [id]/route.ts              # GET /api/jobs/:id
│   │   ├── [id]/cancel/route.ts       # POST /api/jobs/:id/cancel
│   │   ├── [id]/retry/route.ts        # POST /api/jobs/:id/retry
│   │   └── [id]/delete/route.ts       # POST /api/jobs/:id/delete
│   ├── api/download/[id]/route.ts     # GET /api/download/:id
│   ├── api/logs/route.ts              # GET /api/logs?after=N, POST (clear)
│   ├── api/health/route.ts            # GET /api/health (публичный)
│   └── api/cleanup/route.ts           # POST /api/cleanup
├── components/
│   ├── ui/                            # Дизайн-система (примитивы)
│   │   ├── Badge.tsx                  # 6 variants: default/success/warning/error/info/neutral
│   │   ├── Button.tsx                 # 4 variants + loading spinner
│   │   ├── Card.tsx                   # border + hover
│   │   ├── Drawer.tsx                 # Slideover справа, overlay, Escape
│   │   ├── EmptyState.tsx             # 5 иконок + title + description + action
│   │   ├── Input.tsx                  # label/error/hint, focus ring
│   │   ├── Modal.tsx                  # Центрированный, overlay, Escape, actions
│   │   ├── ProgressBar.tsx            # Анимированный, aria-progressbar
│   │   └── Spinner.tsx                # PageSpinner, InlineSpinner
│   ├── ContentCard.tsx                # Карточка контента: thumbnail, meta, пресеты, форматы
│   ├── ConfirmDialog.tsx              # Модальное подтверждение
│   ├── FormatTable.tsx                # Таблица форматов с выбором
│   ├── HistoryPanel.tsx               # Drawer истории задач
│   ├── JobCard.tsx                    # Карточка задачи: статус, прогресс (стадия/процент/скорость/ETA/объём), fresh-подсветка
│   ├── JobDetailsDrawer.tsx           # Drawer деталей задачи: STAGE_LABELS, InfoRow для стадии, прогресс-блок
│   ├── JobList.tsx                    # Polling-список задач: секции Готово → Активные → Требуют внимания, fresh-проп
│   ├── LogPanel.tsx                   # Drawer логов: polling 1.5с, auto-scroll, уровни debug/info/warn/error
│   ├── LoginForm.tsx                  # Форма входа с PinInput
│   ├── PinInput.tsx                   # 6-символьный PIN input (отдельные поля)
│   ├── PlaylistConfirmDialog.tsx      # Подтверждение большого плейлиста
│   ├── ThemeToggle.tsx                # Переключатель dark/light
│   └── URLBar.tsx                     # URL input + "Показать варианты"
├── lib/
│   ├── db.ts          # SQLite + миграции (v1-v4)
│   ├── auth.ts        # APP_PIN_HASH, сессии, timingSafeEqual
│   ├── worker.ts      # Фоновый воркер (setInterval, 3с)
│   ├── downloader.ts  # yt-dlp: extract + download + playlist + cookies
│   ├── muxer.ts       # ffmpeg обёртка через subprocess adapter
│   ├── cleanup.ts     # Очистка по TTL
│   ├── rate-limit.ts  # In-memory rate limiter
│   ├── lockout.ts     # Блокировка после N неудачных попыток
│   ├── health.ts      # Health check (yt-dlp, ffmpeg, БД, cookies)
│   ├── errors.ts      # Типизированные ошибки с user-friendly сообщениями
│   ├── logger.ts      # In-memory кольцевой буфер логов (globalThis)
│   ├── subprocess.ts  # Безопасный subprocess adapter (shell: false)
│   ├── env.ts         # Валидация ENV
│   └── theme-context.tsx # React Context для dark/light темы
├── proxy.ts           # Auth proxy (Next.js 16) — защита API роутов
└── instrumentation.ts # Запуск воркера при старте
```

## Ключевые решения

### Бэкенд
- **proxy.ts** (не middleware.ts): Next.js 16 переименовал middleware в proxy с Node.js runtime
- **Один процесс**: Воркер работает в том же процессе через setInterval + instrumentation.ts
- **Polling на фронтенде**: 2-секундный опрос статуса задач вместо WebSockets
- **Session auth**: HTTP-only cookie, ID сессии в SQLite
- **APP_PIN_HASH**: В ENV кладётся готовый SHA-256 хеш, plaintext PIN нигде не хранится
- **Lockout**: После LOGIN_MAX_ATTEMPTS неудачных попыток — блокировка на LOGIN_LOCKOUT_DURATION секунд
- **Расшифровка:** Notifications: Всё, что есть. Сейчас это не важно. Это просто пример.
  - **Важно:** Дайте мне знать, если я неправильно прочитал или понял ваш запрос. Я всегда готов помочь.

- **subprocess.ts**: Единый безопасный adapter, shell: false, чувствительные аргументы не логируются
- **errors.ts**: Иерархия AppError → ValidationError / AuthError / YtDlpError / RateLimitError / LockoutError. mapYtDlpError мапит stderr в user-friendly русские сообщения
- **Миграции**: user_version pragma, четыре версии (v1: schema, v2: login_attempts+mode, v3: format_id, v4: progress_downloaded/progress_total/progress_speed/progress_eta/current_stage)
- **Хранение файлов**: /data/downloads для готовых, /data/tmp для временных
- **Логирование**: In-memory кольцевой буфер (500 записей) на globalThis — общий для всех модулей Next.js. pushLog/getLogs/clearLogs. GET /api/logs?after=N для polling, POST /api/logs для очистки.
- **Удаление задач**: POST /api/jobs/:id/delete — удаляет запись из БД + чистит tmp и download файлы. Кнопка удаления на JobCard и в JobDetailsDrawer.

### UI / Дизайн-система
- **Тёмная и светлая тема**: CSS-переменные, переключение через `ThemeContext` + localStorage, класс `.dark`/`.light` на `<html>`
- **Акцентный цвет**: emerald (#10b981) — спокойный зелёный, без фиолетовых градиентов
- **Примитивы в `components/ui/`**: Button, Input, Card, Badge, ProgressBar, Drawer, Modal, Spinner, EmptyState
- **PIN input**: 6 отдельных полей с автопереходом, поддержка paste/backspace/стрелок
- **Job polling**: 2-секундный опрос `/api/jobs?status=active`, фильтрация по статусу на клиенте. Секции: Готово → Активные → Требуют внимания.
- **Прогресс задач**: JobCard показывает индикатор для статусов `downloading`/`muxing`:
  - Стадия (`current_stage`) с русским названием через `STAGE_LABELS`: «Скачивание…», «Обработка аудио…»
  - Процент завершения (`progress`) через `ProgressBar` (indeterminate-режим для muxing/extracting)
  - Скорость (`progress_speed`), ETA (`progress_eta`), объём (`progress_downloaded` / `progress_total`)
  - Поля берутся из БД (миграция v4), заполняются воркером из yt-dlp output
- **UX: расположение готовых задач**: Секции отображаются в порядке: Готово → Активные → Требуют внимания (было: Активные → Ошибки → Готово). Готовые задачи — первыми, чтобы пользователь сразу видел доступные для скачивания файлы. Для свежих задач (`ready_at < 30 сек`) применяется `fresh`-проп с CSS-анимацией `fresh-ready` (пульсирующая зелёная box-shadow, 2 сек), привлекающая внимание к только что завершённым задачам.
- **Пресеты форматов**: Best quality / MP4 1080p / MP4 720p / MP3 / M4A — быстрый выбор
- **Advanced mode**: Таблица всех форматов от yt-dlp с сортировкой по размеру
- **Плейлисты**: Подтверждение для >10 элементов, выбор: всё / первые N / только первое
- **Drawer для деталей**: Slide-панель с полной информацией о задаче, прогрессом (стадия через `STAGE_LABELS`, процент, скорость, ETA, объём), `InfoRow` для стадии в сетке деталей
- **История задач**: Drawer со всеми задачами, группировка по статусу, re-run
- **Удаление задач**: Иконка корзины на JobCard (ready/failed/expired) + кнопка "Удалить" в JobDetailsDrawer. DELETE из БД + файлы с диска.
- **Логи**: Drawer (LogPanel) с polling 1.5с. In-memory буфер на globalThis. Уровни debug/info/warn/error. Очистка по кнопке.

## Жизненный цикл задачи

created → extracting → queued → downloading → ready → (TTL) → expired
                                         ↓
                                      failed
