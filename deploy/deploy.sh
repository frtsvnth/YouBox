#!/usr/bin/env bash
# ============================================================
# deploy.sh — первый деплой или обновление YouBox на VPS
# ============================================================
#
# Образ НЕ собирается на сервере — VPS ограничен по CPU, и сборка
# (npm ci/npm run build) регулярно давала устойчивые пики нагрузки,
# из-за которых хостер троттлил/приостанавливал сервер. Образ
# собирается локально или в CI и пушится в ghcr.io/frtsvnth/youbox,
# сервер только скачивает готовый.
#
# Перед деплоем на своей машине:
#   docker buildx build --platform linux/amd64 \
#     -t ghcr.io/frtsvnth/youbox:latest -f Dockerfile --push .
#
# Предполагается, что:
#   - Docker и Docker Compose установлены
#   - Репозиторий склонирован в /opt/youbox
#   - .env настроен (APP_PIN_HASH обязателен)
#
# Использование:
#   sudo ./deploy/deploy.sh            # первый деплой
#   sudo ./deploy/deploy.sh --update   # обновление (git pull + pull образа)
#   sudo ./deploy/deploy.sh --rollback # откат на предыдущий коммит git
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_FILE="docker-compose.yml"
PROJECT="youbox"

echo "============================================"
echo " YouBox Deploy Script"
echo "============================================"

case "${1:-deploy}" in
  deploy)
    echo "[deploy] Pulling and starting YouBox..."

    # Проверка .env
    if [ ! -f .env ]; then
      echo "[deploy] ERROR: .env file not found!"
      echo "[deploy] Copy .env.example to .env and configure:"
      echo "  cp .env.example .env && nano .env"
      exit 1
    fi

    # Проверка APP_PIN_HASH
    if grep -q "APP_PIN_HASH=8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92" .env; then
      echo "[deploy] WARNING: You are using the default APP_PIN_HASH!"
      echo "[deploy] Change it: echo -n 'your-pin' | shasum -a 256 | cut -d' ' -f1"
      echo "[deploy] Sleeping 5 seconds... (Ctrl+C to abort)"
      sleep 5
    fi

    # Создаём необходимые директории
    mkdir -p data/db data/downloads data/tmp
    chmod 0777 data data/db data/downloads data/tmp

    # Скачиваем готовый образ и запускаем (без сборки на сервере)
    docker compose -f "$COMPOSE_FILE" pull youbox
    docker compose -f "$COMPOSE_FILE" up -d

    echo "[deploy] Checking health..."
    sleep 5
    HEALTH=$(docker compose -f "$COMPOSE_FILE" exec -T youbox node -e "
const http = require('http');
http.get('http://localhost:3007/api/health', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => { try { console.log(JSON.parse(d).status); } catch { console.log('unknown'); } });
}).on('error', () => console.log('unknown'));
" 2>/dev/null || echo 'unknown')
    echo "[deploy] Health: $(echo $HEALTH | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","unknown"))' 2>/dev/null || echo 'unknown')"
    echo "[deploy] Done! YouBox is running."
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  --update)
    echo "[deploy] Updating YouBox..."

    # Бэкап перед обновлением
    bash "$SCRIPT_DIR/deploy/backup.sh" "$SCRIPT_DIR/backups"

    # Pull latest changes (если используется git)
    if [ -d .git ]; then
      git pull
    fi

    # Скачиваем свежий образ и перезапускаем (без сборки на сервере)
    docker compose -f "$COMPOSE_FILE" pull youbox
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate youbox

    echo "[deploy] Cleaning up old images..."
    docker image prune -f

    echo "[deploy] Update complete."
    ;;

  --rollback)
    echo "[deploy] Образ теперь приходит из ghcr.io/frtsvnth/youbox, локальной пересборки нет."
    echo "[deploy] Чтобы откатиться, найдите нужный digest в истории пакета:"
    echo "  https://github.com/frtsvnth/YouBox/pkgs/container/youbox"
    echo "[deploy] Затем:"
    echo "  docker pull ghcr.io/frtsvnth/youbox@sha256:<digest>"
    echo "  docker tag ghcr.io/frtsvnth/youbox@sha256:<digest> ghcr.io/frtsvnth/youbox:latest"
    echo "  docker compose -f \"$COMPOSE_FILE\" up -d --force-recreate youbox"
    exit 1
    ;;

  *)
    echo "Usage: $0 [deploy|--update|--rollback]"
    exit 1
    ;;
esac
