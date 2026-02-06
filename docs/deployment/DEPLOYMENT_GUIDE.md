# 狼人杀游戏部署指南 🚀

## 目录
1. [部署选项对比](#部署选项对比)
2. [方案零：Docker本地部署 (最简单)](#方案零docker本地部署-最简单)
3. [方案一：Vercel + Railway (云端推荐)](#方案一vercel--railway-云端推荐)
4. [方案二：Render (全栈部署)](#方案二render-全栈部署)
5. [方案三：自建服务器](#方案三自建服务器)
6. [环境变量配置](#环境变量配置)
7. [常见问题](#常见问题)

---

## 部署选项对比

| 特性 | Docker本地 | Vercel + Railway | Render | 自建服务器 |
|-----|-----------|-----------------|--------|-----------|
| 💰 费用 | 免费 | 免费 | 免费/收费 | 服务器成本 |
| ⚡ 部署速度 | 最快（1分钟） | 非常快（5分钟） | 快（10分钟） | 需要配置 |
| 🔧 难度 | 极简单 | 简单 | 中等 | 复杂 |
| 🌐 访问范围 | 本地/局域网 | 全球 | 全球 | 全球 |
| 📊 WebSocket | 支持 | 支持 | 支持 | 支持 |
| 🔒 HTTPS | 不需要 | 自动 | 自动 | 需要配置 |
| 🎯 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 📍 适用场景 | 本地游戏、开发测试 | 公开分享、生产环境 | 小团队使用 | 企业定制 |

---

## 方案零：Docker本地部署 (最简单) 🐳

### 为什么选择Docker？

- ✅ **最简单**：一行命令搞定
- ✅ **最快速**：1分钟启动
- ✅ **环境隔离**：不污染系统
- ✅ **跨平台**：Windows/Mac/Linux通用
- ✅ **数据持久**：游戏数据不丢失

### 快速开始

```bash
# 1. 确保已安装Docker
docker --version

# 2. 进入项目目录
cd werewolf-app

# 3. 一键启动（自动构建+运行）
docker-compose up -d

# 4. 访问游戏
# 浏览器打开: http://localhost:3000
```

### 常用命令

```bash
# 查看日志
docker-compose logs -f

# 停止游戏
docker-compose down

# 重启游戏
docker-compose restart

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 局域网访问

1. 查看本机IP（例如：`192.168.1.100`）
2. 其他设备访问：`http://192.168.1.100:3000`

**详细文档**: [Docker部署完整指南](./DOCKER_DEPLOYMENT.md)

---

## 方案一：Vercel + Railway (云端推荐) ⭐

---

## 方案一：Vercel + Railway (推荐) ⭐

### 架构说明
- **前端**: 部署到 Vercel (免费、速度快)
- **后端**: 部署到 Railway (免费额度 $5/月)
- **优点**: 免费、自动HTTPS、全球CDN、简单易用

### 步骤1: 准备代码仓库

1. **初始化Git仓库**
```bash
cd werewolf-app
git init
git add .
git commit -m "Initial commit: Werewolf game"
```

2. **推送到GitHub**
```bash
# 在GitHub上创建新仓库: werewolf-game
git remote add origin https://github.com/YOUR_USERNAME/werewolf-game.git
git branch -M main
git push -u origin main
```

### 步骤2: 部署后端到Railway

1. **访问**: https://railway.app/
2. **登录**: 使用GitHub账号登录
3. **新建项目**:
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择 `werewolf-game` 仓库
   - 选择 `server` 目录

4. **配置环境变量**:
   - 点击项目 → Variables
   - 添加以下变量:
   ```
   NODE_ENV=production
   PORT=3001
   ```

5. **获取后端URL**:
   - 在 Settings → Domains 中生成域名
   - 例如: `https://werewolf-game-production.up.railway.app`

### 步骤3: 部署前端到Vercel

1. **访问**: https://vercel.com/
2. **登录**: 使用GitHub账号登录
3. **导入项目**:
   - 点击 "Add New" → "Project"
   - 选择 `werewolf-game` 仓库
   - Framework Preset: 自动检测为 Vite

4. **配置项目**:
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **配置环境变量**:
   - 点击项目 → Settings → Environment Variables
   - 添加:
   ```
   VITE_API_URL=https://werewolf-game-production.up.railway.app
   ```

6. **部署**:
   - 点击 "Deploy"
   - 等待部署完成
   - 获取前端URL: `https://werewolf-game.vercel.app`

### 步骤4: 更新前端API配置

修改 `client/src/services/websocket.ts` 和其他API调用，使用环境变量：

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

修改所有 `http://localhost:3001` 为 `API_URL`。

---

## 方案二：Render (全栈部署) 🎯

### 优点
- 前后端在同一平台
- 免费套餐支持WebSocket
- 自动HTTPS

### 步骤1: 准备代码

创建 `render.yaml`:

```yaml
# render.yaml
services:
  # 后端服务
  - type: web
    name: werewolf-server
    env: node
    region: oregon
    plan: free
    buildCommand: cd server && npm install && npm run build
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001

  # 前端服务
  - type: web
    name: werewolf-client
    env: node
    region: oregon
    plan: free
    buildCommand: cd client && npm install && npm run build
    startCommand: cd client && npm run preview
    envVars:
      - key: VITE_API_URL
        sync: false
```

### 步骤2: 部署到Render

1. **访问**: https://render.com/
2. **登录**: 使用GitHub账号
3. **新建Web Service**:
   - 选择GitHub仓库
   - 配置后端服务
   - 配置前端服务
4. **等待部署完成**

---

## 方案三：自建服务器 💻

### 前置要求
- Linux服务器 (Ubuntu 20.04+)
- 域名 (可选)
- Node.js 18+

### 步骤1: 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装Nginx
sudo apt install nginx -y

# 安装PM2 (进程管理)
sudo npm install -g pm2
```

### 步骤2: 部署应用

```bash
# 克隆代码
cd /var/www
sudo git clone https://github.com/YOUR_USERNAME/werewolf-game.git
cd werewolf-game

# 安装依赖
cd server && npm install && npm run build
cd ../client && npm install && npm run build

# 启动后端
cd ../server
pm2 start dist/index.js --name werewolf-server

# 配置开机自启
pm2 startup
pm2 save
```

### 步骤3: 配置Nginx

创建 `/etc/nginx/sites-available/werewolf`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/werewolf-game/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置:
```bash
sudo ln -s /etc/nginx/sites-available/werewolf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 步骤4: 配置HTTPS (可选)

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com
```

---

## 环境变量配置

### 后端环境变量 (.env)

```bash
# server/.env.production
NODE_ENV=production
PORT=3001

# 数据库 (如果使用)
# DATABASE_URL=postgresql://...

# Session密钥
SESSION_SECRET=your-random-secret-key-here
```

### 前端环境变量

```bash
# client/.env.production
VITE_API_URL=https://your-backend-url.com
VITE_WS_URL=wss://your-backend-url.com
```

---

## 配置文件修改

### 1. 修改前端API地址

创建 `client/src/config.ts`:

```typescript
// client/src/config.ts
const isDev = import.meta.env.DEV;

export const config = {
  apiUrl: isDev
    ? 'http://localhost:3001'
    : import.meta.env.VITE_API_URL || 'https://your-backend.railway.app',
  wsUrl: isDev
    ? 'ws://localhost:3001'
    : import.meta.env.VITE_WS_URL || 'wss://your-backend.railway.app',
};
```

### 2. 更新WebSocket连接

修改 `client/src/services/websocket.ts`:

```typescript
import { io, Socket } from 'socket.io-client';
import { config } from '../config';

class WebSocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io(config.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    // ...
  }
}
```

### 3. 更新所有API调用

修改 `client/src/pages/LoginPage.tsx` 等文件:

```typescript
import { config } from '../config';

// 替换
// const response = await fetch('http://localhost:3001/api/auth/login', {
const response = await fetch(`${config.apiUrl}/api/auth/login`, {
  // ...
});
```

---

## 部署检查清单 ✅

### 代码准备
- [ ] 所有硬编码的 `localhost:3001` 替换为环境变量
- [ ] 添加生产环境配置文件
- [ ] 测试构建命令: `npm run build`
- [ ] 提交代码到GitHub

### 后端部署
- [ ] 创建Railway/Render项目
- [ ] 配置环境变量
- [ ] 等待部署成功
- [ ] 测试API端点: `/health`
- [ ] 获取后端URL

### 前端部署
- [ ] 创建Vercel项目
- [ ] 配置 `VITE_API_URL` 环境变量
- [ ] 等待部署成功
- [ ] 测试前端访问
- [ ] 测试登录功能

### 功能测试
- [ ] 用户登录/注册
- [ ] 创建房间
- [ ] 加入房间
- [ ] WebSocket连接
- [ ] 分配角色
- [ ] 游戏流程

---

## 常见问题 ❓

### Q1: WebSocket连接失败
**解决方案**:
- 确认后端支持WebSocket
- 检查CORS配置
- 使用 `wss://` 而不是 `ws://` (HTTPS)

### Q2: API调用跨域错误
**解决方案**:
在 `server/src/index.ts` 添加CORS配置:
```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://your-frontend.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  // ...
});
```

### Q3: Railway免费额度用完
**解决方案**:
- 使用Render (500小时/月免费)
- 优化代码减少资源使用
- 升级到付费计划 ($5/月)

### Q4: Vercel构建失败
**解决方案**:
- 检查 `package.json` 中的构建命令
- 确认依赖都已安装
- 查看构建日志找到具体错误

### Q5: 数据持久化问题
**解决方案**:
Railway/Render的文件系统不持久，需要：
- 使用PostgreSQL数据库
- 使用Redis存储session
- 使用云存储服务

---

## 推荐流程 🎯

### 快速开始 (5分钟)
```bash
# 1. 推送到GitHub
git init
git add .
git commit -m "Initial commit"
git push -u origin main

# 2. 部署后端到Railway
# - 访问 railway.app
# - 连接GitHub仓库
# - 选择 server 目录
# - 获取URL

# 3. 部署前端到Vercel
# - 访问 vercel.com
# - 连接GitHub仓库
# - 选择 client 目录
# - 配置 VITE_API_URL
# - 部署完成！
```

### 完整部署 (30分钟)
1. 修改所有硬编码URL为环境变量
2. 创建生产环境配置
3. 测试本地构建
4. 推送到GitHub
5. 部署后端 (Railway)
6. 部署前端 (Vercel)
7. 配置环境变量
8. 测试所有功能
9. 配置自定义域名 (可选)

---

## 下一步 🚀

部署完成后:
1. ✅ 分享游戏链接给朋友
2. ✅ 配置自定义域名
3. ✅ 设置监控和日志
4. ✅ 优化性能
5. ✅ 收集用户反馈

---

**现在开始部署吧！** 🎮✨

有任何问题欢迎查看日志或联系支持。
