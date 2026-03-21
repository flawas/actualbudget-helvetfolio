#!/bin/sh
set -e

if [ "$MODE" = "web" ]; then
  exec node /app/src/web-server.js
elif [ "$MODE" = "daemon" ]; then
  exec node /app/src/index.js start-daemon
else
  exec node /app/src/index.js "$@"
fi
