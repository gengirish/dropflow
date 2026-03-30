#!/bin/sh
redis-server --daemonize yes --bind 127.0.0.1 --port 6379
sleep 1
echo "Redis started"
node apps/worker/dist/index.js
