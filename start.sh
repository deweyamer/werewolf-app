#!/bin/sh

# 启动后端服务
cd /app/server
node dist/index.js &

# 启动nginx
nginx -g 'daemon off;'
