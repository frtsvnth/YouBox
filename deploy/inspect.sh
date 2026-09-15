#!/bin/bash
# Ручной вход в Google-аккаунты sidecar через Chrome DevTools
# Использование: ./deploy/inspect.sh
set -euo pipefail

SERVER="root@141.136.44.9"
echo "🔌 Пробрасываю порт CDP с сервера..."
echo "   (не закрывай это окно, пока не закончишь вход)"
echo ""
echo "📋 Дальше открой Chrome и:"
echo "   1. В адресной строке введи: chrome://inspect"
echo "   2. Нажми «Configure...»"
echo "   3. Добавь: 127.0.0.1:9222"
echo "   4. Нажми «Done»"
echo "   5. В секции «Remote Target» найди вкладки account-1 и account-2"
echo "   6. Нажми «inspect» на каждой и войди в Google вручную"
echo ""
echo "   После входа просто закрой это окно (Ctrl+C)."
echo ""

ssh -L 9222:127.0.0.1:3808 -N "$SERVER"
