#!/usr/bin/env bash
# ============================================================
# rotate-cookies.sh — ротация cookies файла
# ============================================================
# Использование:
#   ./deploy/rotate-cookies.sh /path/to/new/cookies.txt
#
# Безопасно заменяет cookies файл без перезапуска контейнера.
# Новый файл монтируется read-only, поэтому:
#   1. Копируем новый файл поверх старого на хосте
#   2. Контейнер подхватит изменения при следующем чтении
#
# Если нужно заменить файл целиком (другой путь):
#   1. Остановите контейнер
#   2. Обновите YT_COOKIES_FILE в .env
#   3. Запустите: docker compose up -d
# ============================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/new/cookies.txt"
  echo ""
  echo "Пример:"
  echo "  $0 ~/new_cookies.txt"
  exit 1
fi

NEW_COOKIES="$1"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${COMPOSE_DIR}/.env"

if [ ! -f "$NEW_COOKIES" ]; then
  echo "[rotate-cookies] ERROR: File not found: $NEW_COOKIES"
  exit 1
fi

# Читаем текущий путь к cookies из .env
CURRENT_COOKIES=""
if [ -f "$ENV_FILE" ]; then
  CURRENT_COOKIES=$(grep -E '^YT_COOKIES_FILE=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || true)
fi

if [ -z "$CURRENT_COOKIES" ]; then
  echo "[rotate-cookies] YT_COOKIES_FILE is not set in .env."
  echo "[rotate-cookies] To use cookies, set YT_COOKIES_FILE=/path/to/cookies.txt in .env"
  echo "[rotate-cookies] Then run: docker compose up -d"
  exit 1
fi

if [ ! -f "$CURRENT_COOKIES" ]; then
  echo "[rotate-cookies] WARNING: Current cookies file not found at $CURRENT_COOKIES"
  echo "[rotate-cookies] Creating directory and copying..."
fi

# Создаём директорию если нужно
COOKIES_DIR=$(dirname "$CURRENT_COOKIES")
mkdir -p "$COOKIES_DIR"

# Копируем новый файл поверх текущего (атомарно через временный файл)
TEMP_FILE="${CURRENT_COOKIES}.tmp"
cp "$NEW_COOKIES" "$TEMP_FILE"
chmod 600 "$TEMP_FILE"
mv "$TEMP_FILE" "$CURRENT_COOKIES"

echo "[rotate-cookies] Cookies rotated successfully: $CURRENT_COOKIES"
echo "[rotate-cookies] Container will pick up the new cookies on next yt-dlp request."
echo "[rotate-cookies] No restart required."
