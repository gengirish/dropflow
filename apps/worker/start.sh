#!/bin/sh
redis-server --daemonize yes --bind 127.0.0.1 --port 6379
sleep 1
echo "Redis started"
cd /app
./node_modules/.bin/tsx apps/worker/src/index.ts
