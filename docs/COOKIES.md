# Cookie Source Management в YouBox

YouBox поддерживает два независимых сценария для работы с cookies YouTube:

- **A. Upload cookies.txt** — загрузка готового файла через UI (рабочий сценарий по умолчанию)
- **B. Browser session на VPS** — запуск Chromium в sidecar-контейнере, ручной вход в аккаунт, экспорт cookies

Оба сценария работают через единый **Cookie Source Manager**, который предоставляет downloader'у
актуальный cookies-файл, независимо от того, какой источник активен.

---

## Как это работает

```
                  ┌─────────────────────────────────┐
                  │     Cookie Source Manager        │
                  │                                  │
                  │  ┌──────────┐  ┌──────────────┐  │
                  │  │ Uploaded │  │   Browser    │  │
                  │  │  File    │  │   Session    │  │
                  │  └────┬─────┘  └──────┬───────┘  │
                  │       │               │          │
                  │       └───────┬───────┘          │
                  │               │                  │
                  │        Active Source             │
                  │               │                  │
                  └───────────────┼──────────────────┘
                                  │
                          resolved cookies.txt
                                  │
                                  ▼
                            yt-dlp downloader
```

Активным может быть только один источник в любой момент времени.
Downloader всегда получает файл через `getResolvedCookiePath()`, который:

1. Проверяет активный источник в БД
2. Если активный источник есть — копирует его файл в `/tmp/youbox-cookies.txt`
3. Если активного источника нет — использует `YT_COOKIES_FILE` из env (старый сценарий)
4. Если и env-файла нет — запускает yt-dlp без cookies

---

## Сценарий A: Upload cookies.txt

### Когда использовать

- У вас уже есть готовый cookies.txt от браузерного расширения (Get cookies.txt, EditThisCookie)
- Вы используете `rotate-cookies.sh` для периодической ротации
- Вы не хотите запускать дополнительный browser sidecar

### Как использовать

1. Откройте **Настройки** (иконка шестерёнки в правом верхнем углу)
2. В разделе «Загрузить cookies.txt» нажмите «Выбрать файл»
3. Выберите ваш `cookies.txt`
4. Файл будет загружен, пройдёт базовую валидацию и станет активным источником

### Формат файла

Ожидается формат **Netscape HTTP Cookie File**:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1700000000	CONSENT	YES+...
.google.com	TRUE	/	TRUE	1700000000	__Secure-3PSID	...
...
```

### Действия

| Действие | Описание |
|----------|----------|
| Загрузить | Загрузить новый cookies.txt |
| Сделать активным | Переключить активный источник на этот файл |
| Проверить | Базовая валидация (формат файла) + глубокая проверка (запрос к YouTube) |
| Заменить | Загрузить новый файл поверх текущего |
| Удалить | Удалить файл с сервера и запись из БД |

> ⚠️ При удалении активного источника будет показано подтверждение.
> После удаления будет использован `YT_COOKIES_FILE` из env, если он настроен.

---

## Сценарий B: Browser session на VPS

### Когда использовать

- Upload-сценарий по какой-то причине не подходит
- Вы хотите использовать свежие cookies от аккаунта, в который можно войти вручную
- Вам нужен постоянный browser profile, который не требует повторного входа

### Требования

- Docker Compose на сервере
- Возможность запустить sidecar-контейнер с Chromium (профиль `browser`)
- Права `SYS_ADMIN` для Chromium (контейнеру)
- Persistent volume для browser profile

### Как включить

1. Добавьте в `.env`:

```env
ENABLE_BROWSER_COOKIE_SOURCE=true
BROWSER_COOKIE_SERVICE_URL=http://youbox-browser:3808
BROWSER_COOKIE_EXPORT_PATH=/data/cookies/browser-exported.txt
```

2. Запустите sidecar:

```bash
docker compose --profile browser up -d youbox-browser
```

3. Перезапустите основной контейнер (подхватит новые ENV):

```bash
docker compose restart youbox
```

### Как использовать

1. Откройте landing page sidecar'а (`http://localhost:3808` через SSH-туннель, см. ниже, или `deploy/inspect.sh`)
2. В выпадающем списке выберите профиль: **«Общий профиль»** для разового ручного сценария,
   либо конкретный **`account-N`**, если хотите, чтобы вход засчитался и для автологина этого
   аккаунта (см. «Авто-обновление cookies» ниже) — это обязательно для аккаунтов с 2FA.
3. Нажмите **«Open browser and YouTube»** — sidecar запустит Chromium с выбранным профилем и откроет YouTube
4. Выполните SSH-туннель на своём компьютере:
   ```bash
   ssh -L 3808:localhost:3808 root@ваш-сервер
   ```
5. Откройте **Chrome** на своём компьютере, перейдите на `chrome://inspect`
6. Нажмите «Configure...» → добавьте `localhost:3808`
7. Нажмите **«inspect»** на вкладке YouTube — откроется полноценный браузер
8. Войдите в аккаунт YouTube вручную (включая 2FA, если он есть) — сессия сохранится в
   выбранном на шаге 2 профиле
9. Вернитесь на landing page → выберите тот же профиль в списке → нажмите **«Export cookies»**
10. Cookies будут экспортированы; если это профиль `account-N`, дальше `/refresh` для этого
    аккаунта будет просто находить уже залогиненную сессию, без повторного ввода пароля

> 💡 **Совет:** Профиль браузера сохраняется в Docker volume и переживает перезапуски —
> вход нужен один раз на профиль. Для аккаунта с 2FA это **единственный** способ его
> авторизовать: автологин пароль+2FA не проходит (см. «Ограничения и риски» ниже).

### Структура browser sidecar

```
browser-sidecar/
├── Dockerfile          # Node 22 + Chromium для браузерной сессии
├── package.json        # Зависимости: express, playwright
└── src/
    └── server.js       # HTTP-сервис: управление браузером, экспорт cookies
```

### API sidecar'а

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/` | GET | Landing page с инструкциями и кнопками |
| `/status` | GET | Статус браузера, профиля, список открытых страниц, активный профиль (`activeProfile`) |
| `/open-youtube` | POST | Запустить браузер (если не запущен) и открыть YouTube. Опц. тело `{ "account": "account-1" }` — открыть именно профиль этого аккаунта вместо общего |
| `/export` | POST | Экспортировать cookies в Netscape формате (опц. тело `{ "profile": "account-1" }`) |
| `/validate` | POST | Проверить наличие YouTube cookies |
| `/accounts` | GET | Список настроенных аккаунтов для автологина (только ключи, без секретов) |
| `/login` | POST | Автологин в Google для аккаунта: тело `{ "account": "account-1" }`. Креды берутся из env sidecar. |
| `/refresh` | POST | Логин при необходимости + экспорт cookies: тело `{ "account": "account-1" }` |
| `/health` | GET | Health check |

### Хранение профиля

- Профиль браузера хранится в Docker volume `youbox_browser_profile`
- Volume переживает перезапуски контейнера
- Путь внутри контейнера: `/browser-profile`
- Если профиль уже есть, повторный вход не требуется (если сессия не истекла)

### Безопасность

- Sidecar доступен только внутри Docker network `youbox_internal`
- Наружу не暴露 порты (только `expose`, не `ports`)
- Все операции с cookies — через авторизованный API YouBox
- Экспортированный файл cookies хранится с правами `600`
- Содержимое cookies не логируется

---

## Переключение между источниками

1. Откройте **Настройки**
2. В разделе «Все источники» найдите нужный источник
3. Нажмите **«Сделать активным»**
4. Downloader начнёт использовать новый файл при следующем скачивании

Активный источник отмечен бейджем «Выбран».

---

## Default source через ENV

Если вы хотите, чтобы по умолчанию использовался browser source (когда он доступен):

```env
DEFAULT_COOKIE_SOURCE=browser_session
```

Если browser source недоступен, произойдёт graceful fallback:
1. Проверяется активный source в БД
2. Если нет — проверяется `YT_COOKIES_FILE` из env
3. Если нет — скачивание без cookies

---

## Health check

В health-эндпоинт добавлена информация об активном источнике cookies:

```json
{
  "cookieSource": {
    "type": "uploaded_file",
    "status": "active",
    "validatedAt": 1700000000
  }
}
```

---

## Fallback behaviour

| Ситуация | Поведение |
|----------|-----------|
| Browser source включен, но sidecar не отвечает | Статус browser — «Остановлен». Экспорт недоступен. Используется другой источник, если активен. |
| Uploaded файл удалён с диска | Статус меняется на `missing`. Используется `YT_COOKIES_FILE` из env (если есть). |
| Активный источник удалён | Удаляется запись из БД + файл. Fallback на `YT_COOKIES_FILE`. |
| Ни одного источника нет | yt-dlp запускается без `--cookies`. |
| Browser source выключен (ENV) | Настройки показывают сообщение, UI для browser скрыт. |

---

## Миграция с YT_COOKIES_FILE на Cookie Source Manager

При первом запуске после добавления Cookie Source Manager, если в `data/cookies` нет ни одного источника,
но `YT_COOKIES_FILE` настроен и файл существует, будет автоматически создан uploaded source из этого файла.

Это обеспечивает бесшовную миграцию без изменения текущей конфигурации.

---

## Операционные сценарии

### First-time setup через upload

1. Экспортируйте cookies из браузера (расширение Get cookies.txt)
2. Загрузите файл через UI Настроек
3. Файл автоматически станет активным
4. Готово

### First-time setup через browser session

1. Запустите browser sidecar: `docker compose --profile browser up -d youbox-browser`
2. Войдите в браузер (через SSH tunnel или Traefik)
3. Перейдите на YouTube и войдите в аккаунт
4. В настройках YouBox нажмите «Экспортировать cookies»
5. Cookies станут активным источником
6. Готово

### Rotation uploaded cookies

1. Загрузите новый cookies.txt через UI
2. Старый файл останется в БД (status: disabled, потом можно удалить вручную)

### Switching active source

1. Откройте Настройки
2. Найдите нужный источник в списке
3. Нажмите «Сделать активным»
4. Источник сменится мгновенно, следующее скачивание будет с новым файлом

### Disable browser mode

1. Установите `ENABLE_BROWSER_COOKIE_SOURCE=false` (или удалите из .env)
2. Остановите sidecar: `docker compose --profile browser down youbox-browser`
3. Активируйте uploaded source через UI
4. Перезапустите основной контейнер

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `ENABLE_BROWSER_COOKIE_SOURCE` | `false` | Включить поддержку browser source |
| `DEFAULT_COOKIE_SOURCE` | `uploaded_file` | Источник по умолчанию (`uploaded_file` или `browser_session`) |
| `BROWSER_COOKIE_SERVICE_URL` | `null` | URL sidecar-сервиса (http://youbox-browser:3808) |
| `BROWSER_COOKIE_EXPORT_PATH` | `null` | Путь для сохранения экспортированных cookies |
| `COOKIE_SOURCE_COOLDOWN_MINUTES` | `45` | Кулдаун источника после ошибки авторизации (минуты) |
| `POT_PROVIDER_URL` | `null` | URL bgutil PO Token provider (http://bgutil-pot:4416). Пусто = выключено |
| `ENABLE_COOKIE_AUTO_REFRESH` | `false` | Включить авто-обновление cookies через sidecar (Playwright autologin) |
| `COOKIE_REFRESH_INTERVAL_MINUTES` | `360` | Интервал авто-обновления cookies (минуты) |
| `GOOGLE_ACCOUNT_<N>_EMAIL` | — | Email Google-аккаунта для автологина (только в .env на VPS) |
| `GOOGLE_ACCOUNT_<N>_PASSWORD` | — | Пароль Google-аккаунта для автологина (только в .env на VPS) |

> ⚠️ `GOOGLE_ACCOUNT_*` задаются ТОЛЬКО в локальном `.env` на сервере и НИКОГДА не попадают в git.

---

## Ротация источников cookies (round-robin + кулдаун)

Начиная с текущей версии, YouBox поддерживает несколько пригодных источников cookies и
автоматически переключается между ними при ошибках авторизации.

**Как работает:**

1. При скачивании downloader использует активный источник и отмечает его `last_used_at`.
2. Если yt-dlp возвращает ошибку авторизации (`BOT_CHECK` — «Sign in to confirm you're not a bot»,
   `NO_FORMATS` — «No video formats found», `CLIENT_BLOCKED` — «content is not available on this app»),
   worker вызывает `markSourceFailed()`:
   - текущий источник помещается в **кулдаун** на `COOKIE_SOURCE_COOLDOWN_MINUTES` минут;
   - выбирается следующий пригодный источник по принципу round-robin (LRU по `last_used_at`);
   - выполняется **одна автоматическая повторная попытка** скачивания с новым источником.
3. Источник считается пригодным, если он не `missing`/`invalid`, файл существует и он не в кулдауне.

В UI (Настройки → Все источники) источник в кулдауне помечается бейджем «В кулдауне»
и показывает время окончания кулдауна.

---

## PO Token provider (bgutil) — обход bot-проверки

YouTube всё чаще требует PO Token. YouBox умеет использовать
[bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) как опциональный sidecar.

**Как включить:**

1. Запустите provider:
   ```bash
   docker compose --profile pot up -d bgutil-pot
   ```
2. Добавьте в `.env`:
   ```env
   POT_PROVIDER_URL=http://bgutil-pot:4416
   ```
3. Перезапустите основной контейнер: `docker compose restart youbox`

Когда `POT_PROVIDER_URL` задан, YouBox добавляет к каждому вызову yt-dlp:
`--extractor-args youtubepot-bgutilhttp:base_url=<URL>`. Если переменная пуста — поведение не меняется.

> Плагин `bgutil-ytdlp-pot-provider` уже установлен в образ через pip.

---

## Авто-обновление cookies (Playwright autologin)

Sidecar `youbox-browser` умеет автоматически входить в Google-аккаунты (без 2FA) и переэкспортировать
cookies по расписанию. Это позволяет держать cookies свежими без ручного входа.

**Как включить:**

1. Задайте аккаунты в `.env` на VPS (НЕ в git):
   ```env
   GOOGLE_ACCOUNT_1_EMAIL=...
   GOOGLE_ACCOUNT_1_PASSWORD=...
   GOOGLE_ACCOUNT_2_EMAIL=...
   GOOGLE_ACCOUNT_2_PASSWORD=...
   ```
2. Включите планировщик и sidecar:
   ```env
   ENABLE_BROWSER_COOKIE_SOURCE=true
   BROWSER_COOKIE_SERVICE_URL=http://youbox-browser:3808
   ENABLE_COOKIE_AUTO_REFRESH=true
   COOKIE_REFRESH_INTERVAL_MINUTES=360
   ```
3. Запустите: `docker compose --profile browser up -d youbox-browser && docker compose restart youbox`

**Как работает:**

- Каждый аккаунт получает изолированный профиль под `/browser-profile/account-<N>`.
- Планировщик (`src/lib/cookie-refresh.ts`) по интервалу вызывает sidecar `/refresh` для каждого аккаунта:
  логинится (если сессия истекла) и экспортирует cookies.
- Экспортированный файл сохраняется в `data/cookies/browser-<account>.txt` (права `600`),
  регистрируется как источник cookies и валидируется.
- Статус последнего обновления виден в health-эндпоинте (`cookieRefresh`).

**Ограничения и риски автологина:**

- Google может обнаружить автоматический вход и потребовать **captcha** или подтверждение
  «это вы?» / «unusual activity». В этом случае sidecar вернёт понятную ошибку, а автологин не сработает.
- **2FA паролем+кодом автоматически не проходится.** `googleLogin()` умеет только email+пароль;
  дойдя до экрана 2FA, он останавливается с понятной ошибкой и ничего не повторяет.
- **Обязательный ручной вход для аккаунтов с 2FA:** прежде чем добавлять
  `GOOGLE_ACCOUNT_<N>_EMAIL`/`_PASSWORD` в `.env`, войдите в этот аккаунт вручную через
  landing page sidecar'а, выбрав в списке именно `account-N` (см. Сценарий B, шаги 1-10).
  После этого `googleLogin()` при каждом `/refresh` сначала проверяет, залогинены ли уже
  (`isLoggedInYouTube`), и если да — сразу отдаёт cookies без единого обращения к полям
  email/пароля. Это устраняет риск того, что автоматика столкнётся с 2FA раньше человека.
- **Порядок важен:** пока `GOOGLE_ACCOUNT_<N>_EMAIL`/`_PASSWORD` не заданы в `.env`, `/accounts`
  не отдаёт этот ключ, и планировщик авто-обновления его не трогает — можно спокойно
  создать и авторизовать профиль вручную заранее, без риска, что автологин полезет
  туда раньше вас.
- **Fallback для обычных (без 2FA) аккаунтов:** если автологин перестал проходить (сессия
  истекла), войдите вручную один раз тем же способом — сессия обновится в профиле, и
  `/refresh` снова начнёт работать без пароля.
