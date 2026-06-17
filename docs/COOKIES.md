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

1. Откройте **Настройки** в YouBox (шестерёнка в правом верхнем углу)
2. Нажмите **«🌐 Открыть браузер и YouTube»** — sidecar запустит Chromium и откроет YouTube
3. Выполните SSH-туннель на своём компьютере (команда показана в UI, можно скопировать одной кнопкой):
   ```bash
   ssh -L 3808:localhost:3808 root@ваш-сервер
   ```
4. Откройте **Chrome** на своём компьютере, перейдите на `chrome://inspect`
5. Нажмите «Configure...» → добавьте `localhost:3808`
6. Нажмите **«inspect»** на вкладке YouTube — откроется полноценный браузер
7. Войдите в аккаунт YouTube — сессия сохранится в профиле
8. Вернитесь в YouBox → Настройки → нажмите **«📦 Экспортировать cookies»**
9. Cookies будут экспортированы и автоматически активированы

> 💡 **Совет:** Если не хотите каждый раз подключаться через `chrome://inspect`, достаточно войти в аккаунт один раз. Профиль браузера сохраняется в Docker volume и переживает перезапуски.

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
| `/status` | GET | Статус браузера, профиля, список открытых страниц |
| `/open-youtube` | POST | Запустить браузер (если не запущен) и открыть YouTube |
| `/export` | POST | Экспортировать cookies в Netscape формате |
| `/validate` | POST | Проверить наличие YouTube cookies |
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
