#!/usr/bin/env bash
# ============================================================
# update-yt-dlp.sh — обновление yt-dlp внутри контейнера
# ============================================================
# Использование:
#   ./deploy/update-yt-dlp.sh          # без перезапуска контейнера
#   ./deploy/update-yt-dlp.sh --restart # с перезапуском контейнера
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
PROJECT_NAME="youbox"

echo "[update-yt-dlp] Updating yt-dlp..."

# Проверка что контейнер запущен
if ! docker ps --format '{{.Names}}' | grep -q "^${PROJECT_NAME}$"; then
  echo "[update-yt-dlp] ERROR: Container '${PROJECT_NAME}' is not running."
  echo "[update-yt-dlp] Start it first: docker compose -f ${COMPOSE_FILE} up -d"
  exit 1
fi

# Обновление через pip внутри контейнера
docker exec "${PROJECT_NAME}" pip install --break-system-packages --no-cache-dir -U yt-dlp

echo "[update-yt-dlp] Verifying version..."
docker exec "${PROJECT_NAME}" yt-dlp --version

echo "[update-yt-dlp] yt-dlp updated successfully."

# Опциональный перезапуск
if [ "${1:-}" = "--restart" ]; then
  echo "[update-yt-dlp] Restarting container..."
  docker compose -f "${COMPOSE_FILE}" restart "${PROJECT_NAME}"
  echo "[update-yt-dlp] Container restarted."
fi
