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
PORT=3000

# === Логирование ===
LOG_LEVEL=info             # debug | info | warn | error
```

## Структура проекта

```
src/
├── app/
│   ├── globals.css                    # Дизайн-система: theme tokens, dark/light
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
│   │   └── [id]/cancel/route.ts       # POST /api/jobs/:id/cancel
│   ├── api/download/[id]/route.ts     # GET /api/download/:id
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
│   ├── JobCard.tsx                    # Карточка задачи: статус, прогресс, действия
│   ├── JobDetailsDrawer.tsx           # Drawer деталей задачи
│   ├── JobList.tsx                    # Polling-список активных задач
│   ├── LoginForm.tsx                  # Форма входа с PinInput
│   ├── PinInput.tsx                   # 6-символьный PIN input (отдельные поля)
│   ├── PlaylistConfirmDialog.tsx      # Подтверждение большого плейлиста
│   ├── ThemeToggle.tsx                # Переключатель dark/light
│   └── URLBar.tsx                     # URL input + "Показать варианты"
├── lib/
│   ├── db.ts          # SQLite + миграции (v1-v3)
│   ├── auth.ts        # APP_PIN_HASH, сессии, timingSafeEqual
│   ├── worker.ts      # Фоновый воркер (setInterval, 3с)
│   ├── downloader.ts  # yt-dlp: extract + download + playlist + cookies
│   ├── muxer.ts       # ffmpeg обёртка через subprocess adapter
│   ├── cleanup.ts     # Очистка по TTL
│   ├── rate-limit.ts  # In-memory rate limiter
│   ├── lockout.ts     # Блокировка после N неудачных попыток
│   ├── health.ts      # Health check (yt-dlp, ffmpeg, БД, cookies)
│   ├── errors.ts      # Типизированные ошибки с user-friendly сообщениями
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
- **subprocess.ts**: Единый безопасный adapter, shell: false, чувствительные аргументы не логируются
- **errors.ts**: Иерархия AppError → ValidationError / AuthError / YtDlpError / RateLimitError / LockoutError. mapYtDlpError мапит stderr в user-friendly русские сообщения
- **Миграции**: user_version pragma, три версии (v1: schema, v2: login_attempts+mode, v3: format_id)
- **Хранение файлов**: /data/downloads для готовых, /data/tmp для временных

### UI / Дизайн-система
- **Тёмная и светлая тема**: CSS-переменные, переключение через `ThemeContext` + localStorage, класс `.dark`/`.light` на `<html>`
- **Акцентный цвет**: emerald (#10b981) — спокойный зелёный, без фиолетовых градиентов
- **Примитивы в `components/ui/`**: Button, Input, Card, Badge, ProgressBar, Drawer, Modal, Spinner, EmptyState
- **PIN input**: 6 отдельных полей с автопереходом, поддержка paste/backspace/стрелок
- **Job polling**: Обновление списка задач каждые 2 секунды для active статусов
- **Пресеты форматов**: Best quality / MP4 1080p / MP4 720p / MP3 / M4A — быстрый выбор
- **Advanced mode**: Таблица всех форматов от yt-dlp с сортировкой по размеру
- **Плейлисты**: Подтверждение для >10 элементов, выбор: всё / первые N / только первое
- **Drawer для деталей**: Slide-панель с полной информацией о задаче, прогрессом, действиями
- **История задач**: Drawer со всеми задачами, группировка по статусу, re-run

## Жизненный цикл задачи

created → extracting → queued → downloading → ready → (TTL) → expired
                                         ↓
                                      failed
