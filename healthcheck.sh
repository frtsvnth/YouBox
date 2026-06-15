#!/bin/sh
# Docker HEALTHCHECK — проверяет HTTP-доступность и статус приложения
# Возвращает 0 если всё ок, 1 если degraded, 2 если error

set -e

RESPONSE=$(wget -q -O - http://localhost:3000/api/health 2>/dev/null || curl -sf http://localhost:3000/api/health 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  exit 2
fi

STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','error'))" 2>/dev/null)

case "$STATUS" in
  ok)
    exit 0
    ;;
  degraded)
    exit 1
    ;;
  *)
    exit 2
    ;;
esac
