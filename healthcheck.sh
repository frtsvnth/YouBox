#!/bin/sh
# Docker HEALTHCHECK — проверяет HTTP-доступность и статус приложения
# Exit 0 = ok, 1 = degraded, 2 = error (перезапуск контейнера)

RESPONSE=$(wget -q -O - http://localhost:3000/api/health 2>/dev/null || curl -sf http://localhost:3000/api/health 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  exit 2
fi

# Парсинг JSON через grep — без зависимостей (не нужен python3)
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

case "$STATUS" in
  ok)       exit 0 ;;
  degraded) exit 1 ;;
  *)        exit 2 ;;
esac
