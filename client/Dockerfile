# 🐺 狼人杀前端应用 - Docker镜像
# 适用于：阿里云函数计算、独立部署

# ========================================
# 阶段1: 构建
# ========================================
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package.json
COPY package*.json ./
COPY ../shared/package*.json ../shared/

# 安装依赖
RUN npm ci && npm cache clean --force

# 复制源代码和配置
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY src ./src
COPY ../shared ../shared

# 构建（使用环境变量）
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ========================================
# 阶段2: 生产环境（Nginx）
# ========================================
FROM nginx:alpine

LABEL maintainer="werewolf-game"
LABEL description="狼人杀前端应用"
LABEL service="frontend"

# 复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
