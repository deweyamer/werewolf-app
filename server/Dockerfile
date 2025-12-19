# 🐺 狼人杀后端服务 - Docker镜像
# 适用于：阿里云函数计算、独立部署

# ========================================
# 阶段1: 构建
# ========================================
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package.json
COPY package*.json ./
COPY ../shared/package*.json ../shared/

# 安装依赖（包含devDependencies用于构建）
RUN npm ci && npm cache clean --force

# 复制源代码
COPY tsconfig.json ./
COPY src ./src
COPY ../shared ../shared

# 构建TypeScript
RUN npm run build

# ========================================
# 阶段2: 生产环境
# ========================================
FROM node:18-alpine

LABEL maintainer="werewolf-game"
LABEL description="狼人杀后端服务"
LABEL service="backend"

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 创建数据目录
RUN mkdir -p /app/data && chmod 777 /app/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "dist/index.js"]
