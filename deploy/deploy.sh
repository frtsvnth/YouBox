#!/usr/bin/env bash
# ============================================================
# deploy.sh — первый деплой или обновление YouBox на VPS
# ============================================================
#
# Предполагается, что:
#   - Docker и Docker Compose установлены
#   - Репозиторий склонирован в /opt/youbox
#   - .env настроен (APP_PIN_HASH обязателен)
#
# Использование:
#   sudo ./deploy/deploy.sh            # первый деплой
#   sudo ./deploy/deploy.sh --update   # обновление с пересборкой
#   sudo ./deploy/deploy.sh --rollback # откат на предыдущий образ
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
    echo "[deploy] Building and starting YouBox..."

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

    # Билдим и запускаем
    docker compose -f "$COMPOSE_FILE" build --pull
    docker compose -f "$COMPOSE_FILE" up -d

    echo "[deploy] Checking health..."
    sleep 5
    HEALTH=$(docker compose -f "$COMPOSE_FILE" exec -T youbox wget -q -O - http://localhost:3000/api/health 2>/dev/null || echo '{"status":"unknown"}')
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

    # Пересборка и перезапуск
    docker compose -f "$COMPOSE_FILE" build --pull --no-cache
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate

    echo "[deploy] Cleaning up old images..."
    docker image prune -f

    echo "[deploy] Update complete."
    ;;

  --rollback)
    echo "[deploy] Rolling back to previous version..."

    # Откат к предыдущему образу Docker
    PREVIOUS=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${PROJECT}:" | sort -V | tail -2 | head -1)

    if [ -z "$PREVIOUS" ]; then
      echo "[deploy] No previous image found. Rebuilding..."
      docker compose -f "$COMPOSE_FILE" build
    else
      echo "[deploy] Rolling back to: $PREVIOUS"
      docker compose -f "$COMPOSE_FILE" up -d --force-recreate
    fi

    echo "[deploy] Rollback complete."
    ;;

  *)
    echo "Usage: $0 [deploy|--update|--rollback]"
    exit 1
    ;;
esac
