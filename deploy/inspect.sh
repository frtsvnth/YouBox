#!/bin/bash
# Ручной вход в Google-аккаунты sidecar через Chrome DevTools
# Использование:
#   ./deploy/inspect.sh              — общий (корневой) профиль
#   ./deploy/inspect.sh account-3    — профиль конкретного аккаунта автологина
#                                       (обязательно для аккаунтов с 2FA — см. docs/COOKIES.md)
set -euo pipefail

SERVER="root@141.136.44.9"
ACCOUNT="${1:-}"

if [ -n "$ACCOUNT" ]; then
  echo "🚀 Запускаю браузер с профилем $ACCOUNT на сервере..."
  ssh "$SERVER" "curl -s -X POST http://127.0.0.1:3808/open-youtube -H 'Content-Type: application/json' -d '{\"account\":\"$ACCOUNT\"}'" || true
  echo ""
fi

echo "🔌 Пробрасываю порт CDP с сервера..."
echo "   (не закрывай это окно, пока не закончишь вход)"
echo ""
echo "📋 Дальше открой Chrome и:"
echo "   1. В адресной строке введи: chrome://inspect"
echo "   2. Нажми «Configure...»"
echo "   3. Добавь: 127.0.0.1:9222"
echo "   4. Нажми «Done»"
echo "   5. В секции «Remote Target» найди вкладку YouTube (профиль: ${ACCOUNT:-общий})"
echo "   6. Нажми «inspect» и войди в Google вручную"
if [ -n "$ACCOUNT" ]; then
  echo "      — включая код 2FA из приложения-аутентификатора, если аккаунт его требует"
fi
echo ""
echo "   Когда вход подтверждён (виден аватар YouTube), открой http://localhost:9222/"
echo "   в обычной вкладке, выбери тот же профиль (${ACCOUNT:-общий}) в списке и нажми"
echo "   «Export cookies», чтобы сразу проверить и активировать источник cookies."
echo ""
echo "   После этого просто закрой это окно (Ctrl+C)."
echo ""

ssh -L 9222:127.0.0.1:3808 -N "$SERVER"
