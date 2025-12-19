# 狼人杀游戏 - Docker镜像

# ========================================
# 阶段1: 构建 shared + server
# ========================================
FROM node:18-alpine AS server-builder

WORKDIR /app

# 复制根目录 tsconfig
COPY tsconfig.json ./

# 复制 shared
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src

# 复制 server
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src ./server/src

# 安装并构建 server（会自动引用 shared）
RUN cd server && npm install && npm run build

# ========================================
# 阶段2: 构建前端
# ========================================
FROM node:18-alpine AS client-builder

WORKDIR /app

# 复制根目录 tsconfig
COPY tsconfig.json ./

# 复制 shared
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src

# 复制 client
COPY client/package*.json ./client/
COPY client/tsconfig.json ./client/
COPY client/vite.config.ts ./client/
COPY client/index.html ./client/
COPY client/tailwind.config.js ./client/
COPY client/postcss.config.js ./client/
COPY client/src ./client/src

# 安装并构建 client
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN cd client && npm install && npm run build

# ========================================
# 阶段3: 生产环境镜像
# ========================================
FROM node:18-alpine

LABEL maintainer="werewolf-game"
LABEL description="狼人杀摄梦人12人版"

WORKDIR /app

# 安装nginx和必要工具
RUN apk add --no-cache nginx curl && rm -rf /var/cache/apk/*

# 创建nginx运行目录
RUN mkdir -p /run/nginx

# 复制后端构建产物和依赖
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package*.json ./server/

# 复制前端构建产物
COPY --from=client-builder /app/client/dist /usr/share/nginx/html

# 复制配置文件
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /start.sh
RUN chmod +x /start.sh

# 创建数据目录
RUN mkdir -p /app/server/data && chmod 777 /app/server/data

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 暴露端口
EXPOSE 80

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 启动
CMD ["/start.sh"]
