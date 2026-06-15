#!/usr/bin/env bash
# ============================================================
# backup.sh — бэкап SQLite и метаданных загрузок
# ============================================================
# Использование:
#   ./deploy/backup.sh                    # бэкап в ./backups/
#   ./deploy/backup.sh /path/to/backups   # бэкап в указанную директорию
#
# Добавить в cron (ежедневно в 3:00):
#   0 3 * * * /opt/youbox/deploy/backup.sh /opt/backups/youbox
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${1:-${SCRIPT_DIR}/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
PROJECT_NAME="youbox"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup to ${BACKUP_DIR}..."

# 1. Бэкап SQLite через docker exec
echo "[backup] Backing up SQLite database..."
docker exec "${PROJECT_NAME}" sh -c "
  sqlite3 /data/db/youbox.db \"
    .backup '/tmp/youbox_backup_${TIMESTAMP}.db'
  \" && cat /tmp/youbox_backup_${TIMESTAMP}.db
" > "${BACKUP_DIR}/youbox_${TIMESTAMP}.db" 2>/dev/null

# Если sqlite3 нет внутри контейнера, копируем файл напрямую
if [ ! -f "${BACKUP_DIR}/youbox_${TIMESTAMP}.db" ] || [ ! -s "${BACKUP_DIR}/youbox_${TIMESTAMP}.db" ]; then
  echo "[backup] sqlite3 not found in container, copying DB file directly..."
  docker cp "${PROJECT_NAME}:/data/db/youbox.db" "${BACKUP_DIR}/youbox_${TIMESTAMP}.db"
fi

echo "[backup] SQLite backup: ${BACKUP_DIR}/youbox_${TIMESTAMP}.db"

# 2. Экспорт метаданных задач в JSON
echo "[backup] Exporting job metadata..."
docker exec "${PROJECT_NAME}" sh -c "
  sqlite3 -json /data/db/youbox.db 'SELECT * FROM jobs ORDER BY created_at DESC;'
" > "${BACKUP_DIR}/jobs_${TIMESTAMP}.json" 2>/dev/null || {
  echo "[backup] WARNING: Could not export JSON metadata (sqlite3 -json not available)"
}

# 3. Список файлов в downloads
echo "[backup] Listing downloads directory..."
docker exec "${PROJECT_NAME}" ls -la /data/downloads/ > "${BACKUP_DIR}/downloads_manifest_${TIMESTAMP}.txt" 2>/dev/null || true

# 4. Очистка старых бэкапов (старше 30 дней)
echo "[backup] Cleaning backups older than 30 days..."
find "${BACKUP_DIR}" -name "youbox_*.db" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "jobs_*.json" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "downloads_manifest_*.txt" -mtime +30 -delete 2>/dev/null || true

echo "[backup] Done: ${BACKUP_DIR}/youbox_${TIMESTAMP}.db"
echo "[backup] To restore: docker cp ${BACKUP_DIR}/youbox_${TIMESTAMP}.db ${PROJECT_NAME}:/data/db/youbox.db"
