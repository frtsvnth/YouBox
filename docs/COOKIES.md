# Cookies: настройка и эксплуатация

> **Внимание**: cookies.txt — это **чувствительный секрет**. Он содержит ваши логин-сессии к YouTube и другим сайтам.
> Хранение и передача cookies-файла должны быть максимально защищены.

---

## Зачем нужен cookies.txt

YouBox использует yt-dlp для загрузки видео. Некоторые сайты (YouTube, Vimeo и др.) требуют аутентификации для доступа к контенту:

- **Возрастные ограничения** (18+ видео)
- **Приватные видео**
- **DDoS-защита** (YouTube может требовать cookies для разблокировки)
- **Региональные ограничения**

Cookies-файл — это экспортированные сессионные куки из вашего браузера. yt-dlp передаёт их при запросе, "притворяясь" вашим браузером.

## Безопасность cookies

### ⚠️ Никогда не делайте:

- Не коммитьте cookies.txt в git (даже в приватный репозиторий)
- Не храните cookies.txt внутри каталога репозитория (`/opt/youbox/`)
- Не передавайте cookies.txt через незащищённые каналы (мессенджеры, email)
- Не логируйте содержимое cookies
- Не используйте один cookies-файл для нескольких людей
- Не храните cookies.txt в общедоступных директориях (`/tmp`, `/var/www`, `~/Downloads`)

### ✅ Рекомендации:

- Храните cookies.txt **вне каталога репозитория**, например:
  ```bash
  /opt/youbox-secrets/youtube.cookies.txt
  ```
- Используйте выделенный аккаунт Google (не личный) для экспорта cookies
- Установите правильные права:
  ```bash
  sudo mkdir -p /opt/youbox-secrets
  sudo chmod 700 /opt/youbox-secrets
  sudo chown $USER:$USER /opt/youbox-secrets
  ```
- Регулярно обновляйте cookies (раз в 1-3 месяца)

## Первая настройка

### 1. Экспорт cookies из браузера

Установите расширение (на компьютере, НЕ на сервере):

- **[Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)** (Chrome/Edge)
- **cookies.txt** (Firefox)

Инструкция:
1. Откройте YouTube в браузере и **войдите в аккаунт**
2. Нажмите на иконку расширения → "Export"
3. Сохраните файл как `youtube.cookies.txt`

### 2. Копирование на VPS

```bash
# Локально (на вашем компьютере)
scp youtube.cookies.txt user@your-server-ip:/opt/youbox-secrets/youtube.cookies.txt
```

После копирования на сервере:
```bash
ssh user@your-server-ip
chmod 600 /opt/youbox-secrets/youtube.cookies.txt
```

### 3. Настройка YouBox

В файле `/opt/youbox/.env` укажите:

```env
YT_COOKIES_FILE=/opt/youbox-secrets/youtube.cookies.txt
```

### 4. Как это работает в Docker Compose

В `docker-compose.yml` cookies файл монтируется **read-only**:

```yaml
volumes:
  - /opt/youbox-secrets/youtube.cookies.txt:/cookies/cookies.txt:ro
```

Внутри контейнера:
- Файл доступен по пути `/cookies/cookies.txt`
- Приложение (через `env.YT_COOKIES_FILE`) знает этот путь
- Файл смонтирован `ro` — контейнер не может его изменить или удалить

### 5. Проверка

```bash
# Проверка что контейнер видит файл
docker exec youbox ls -la /cookies/cookies.txt

# Проверка через health endpoint
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Ищем: "cookiesFile": { "available": true, "path": null }
```

## Жизненный цикл cookies

### Когда cookies протухают

Cookies-файл живёт от нескольких недель до нескольких месяцев. Признаки:

1. **Health endpoint показывает degraded**:
   ```json
   { "status": "degraded", "cookiesFile": { "available": true, "path": null } }
   ```
   — файл существует, но YouTube перестал его принимать

2. **Ошибки yt-dlp**: "Sign in to confirm your age", "HTTP Error 403", "Video unavailable"

3. **Видео не загружаются**, хотя сервис работает

### Ротация cookies

Когда cookies протухли, замените их на свежие:

```bash
# 1. На компьютере — экспортируйте свежие cookies из браузера
# 2. Скопируйте на сервер
scp fresh_cookies.txt user@server:/tmp/

# 3. На сервере — выполните ротацию
/opt/youbox/deploy/rotate-cookies.sh /tmp/fresh_cookies.txt
```

Скрипт `rotate-cookies.sh`:
- Копирует новый файл во временный
- Устанавливает права `600`
- Атомарно заменяет старый файл (через `mv`)
- **Не требует перезапуска контейнера** — Docker bind mount подхватит изменения

### Если cookies-файла нет

Приложение продолжает работать в **degraded mode**:

| Состояние | Health status | Поведение |
|-----------|--------------|-----------|
| Cookies не настроены | `ok` | yt-dlp работает без cookies |
| Cookies настроены, файл отсутствует | `degraded` | yt-dlp без cookies, предупреждение в health |
| Cookies настроены, файл есть | `ok` | yt-dlp с cookies |
| Cookies есть, но YouTube их не принимает | `ok` (но ошибки yt-dlp) | Нужна ротация |

Docker HEALTHCHECK **не упадёт** в degraded mode (exit code 1 ≠ 2).

## Best practices

1. **Выделенный аккаунт**: используйте отдельный Google-аккаунт для экспорта cookies. Не используйте личный.
2. **Минимальные права**: cookies.txt на сервере — `chmod 600`, директория — `chmod 700`
3. **Храните вне репозитория**: `/opt/youbox-secrets/` — рекомендованный путь
4. **Не логируйте**: приложение redactит путь к cookies в debug-логах (заменяет на `<redacted>`)
5. **Регулярная ротация**: добавьте напоминание в календарь раз в 2 месяца
6. **Мониторинг**: проверяйте `/api/health` — если status `degraded`, проверьте cookies
7. **Отзыв**: если скомпрометировали cookies — смените пароль Google и экспортируйте новые
