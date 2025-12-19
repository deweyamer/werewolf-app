# 部署步骤速查 ⚡

## 🚀 最快部署方式（5分钟）

### 方法：Railway（后端） + Vercel（前端）

---

## 第一步：准备GitHub仓库 📦

```bash
# 1. 进入项目目录
cd werewolf-app

# 2. 初始化Git（如果还没有）
git init

# 3. 添加所有文件
git add .

# 4. 提交
git commit -m "feat: 狼人杀游戏完整版"

# 5. 在GitHub创建新仓库
# 访问: https://github.com/new
# 仓库名: werewolf-game
# 设置为Public

# 6. 推送到GitHub
git remote add origin https://github.com/YOUR_USERNAME/werewolf-game.git
git branch -M main
git push -u origin main
```

---

## 第二步：部署后端到Railway 🚂

### 1. 注册并登录
- 访问: https://railway.app/
- 点击 "Login" → 使用GitHub账号登录

### 2. 创建新项目
- 点击 "New Project"
- 选择 "Deploy from GitHub repo"
- 选择你的 `werewolf-game` 仓库
- 点击 "Deploy Now"

### 3. 配置根目录（重要！）
- 点击项目名称
- 进入 "Settings" 标签
- 找到 "Root Directory"
- 输入: `server`
- 点击 "Save Changes"

### 4. 配置构建命令
- 在 "Settings" 中找到 "Build Command"
- 输入: `npm install && npm run build`
- Start Command: `node dist/index.js`

### 5. 添加环境变量
- 进入 "Variables" 标签
- 点击 "New Variable"
- 添加以下变量:
  ```
  NODE_ENV=production
  PORT=3001
  ```

### 6. 生成公开URL
- 进入 "Settings" → "Networking"
- 点击 "Generate Domain"
- 复制生成的URL，例如: `https://werewolf-game-production.up.railway.app`
- **保存这个URL！后面要用**

### 7. 等待部署
- 查看 "Deployments" 标签
- 等待状态变为 "Success"（约2-3分钟）
- 点击URL测试: `你的URL/health` 应该返回 `{"status":"ok"}`

---

## 第三步：部署前端到Vercel 🔺

### 1. 注册并登录
- 访问: https://vercel.com/
- 点击 "Sign Up" → 使用GitHub账号登录

### 2. 导入项目
- 点击 "Add New..." → "Project"
- 选择 `werewolf-game` 仓库
- 点击 "Import"

### 3. 配置项目设置
**Framework Preset**: Vite (自动检测)

**Root Directory**:
- 点击 "Edit"
- 输入: `client`

**Build Settings**:
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 4. 配置环境变量（最重要！）
- 展开 "Environment Variables" 部分
- 添加变量:
  - Key: `VITE_API_URL`
  - Value: 你的Railway后端URL（例如: `https://werewolf-game-production.up.railway.app`）
  - 选择: Production, Preview, Development (全选)

### 5. 部署
- 点击 "Deploy"
- 等待部署完成（约2-3分钟）
- 获取前端URL: `https://werewolf-game-xxx.vercel.app`

---

## 第四步：更新代码使用环境变量 🔧

### 1. 更新LoginPage.tsx

找到并替换所有 `http://localhost:3001`:

```typescript
// client/src/pages/LoginPage.tsx
import { config } from '../config';

// 修改fetch调用
const response = await fetch(`${config.apiUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
```

### 2. 更新websocket.ts

```typescript
// client/src/services/websocket.ts
import { io, Socket } from 'socket.io-client';
import { config } from '../config';

class WebSocketService {
  connect(token: string) {
    this.socket = io(config.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    // ...
  }
}
```

### 3. 搜索并替换所有硬编码URL

在VSCode中:
1. 按 `Ctrl + Shift + F` 打开全局搜索
2. 搜索: `http://localhost:3001`
3. 在 `client/src` 目录下的所有文件中
4. 替换为: `${config.apiUrl}`（注意：需要先import config）

### 4. 提交并推送更新

```bash
git add .
git commit -m "fix: 使用环境变量替换硬编码URL"
git push
```

### 5. 自动重新部署
- Vercel会自动检测到推送并重新部署
- 等待1-2分钟
- 访问你的前端URL测试

---

## 第五步：测试部署 ✅

### 1. 测试后端
访问: `你的Railway URL/health`
期望返回:
```json
{"status":"ok"}
```

### 2. 测试前端
访问: `你的Vercel URL`
应该看到登录页面

### 3. 测试登录
- 用户名: `god`
- 密码: `god`
- 点击登录
- 如果成功，说明前后端连接正常！

### 4. 测试完整游戏流程
1. 登录上帝账号创建房间
2. 打开新标签页登录test1-test12
3. 所有玩家加入房间
4. 分配角色
5. 开始游戏
6. 测试女巫界面
7. 完成一个完整回合

---

## 常见问题速查 🔥

### ❌ 前端显示"网络错误"
**原因**: VITE_API_URL配置错误
**解决**:
1. 进入Vercel项目 → Settings → Environment Variables
2. 检查 `VITE_API_URL` 是否正确
3. 确保URL没有尾部斜杠 `/`
4. 重新部署: Deployments → 最新部署 → 点击 "Redeploy"

### ❌ WebSocket连接失败
**原因**: 后端不支持WebSocket或CORS问题
**解决**:
1. 检查Railway部署日志
2. 确认后端启动成功
3. 测试 `/health` 端点
4. 检查浏览器控制台错误

### ❌ CORS错误
**原因**: 后端没有允许前端域名
**解决**:
在 `server/src/index.ts` 修改CORS配置:
```typescript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://your-vercel-app.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});
```

### ❌ Railway构建失败
**原因**: 缺少依赖或配置错误
**解决**:
1. 检查 `server/package.json` 是否有所有依赖
2. 确认Root Directory设置为 `server`
3. 检查Build Command: `npm install && npm run build`
4. 查看部署日志找到具体错误

### ❌ Vercel构建失败
**原因**: 找不到文件或依赖问题
**解决**:
1. 确认Root Directory设置为 `client`
2. 检查 `client/package.json`
3. 确认 `vite.config.ts` 配置正确
4. 查看构建日志

---

## 优化建议 🎯

### 1. 配置自定义域名
**Vercel**:
- Settings → Domains → Add Domain
- 输入你的域名
- 配置DNS记录

**Railway**:
- Settings → Public Networking → Custom Domain
- 输入你的域名

### 2. 设置环境变量
创建 `.env.example` 文件:
```bash
# client/.env.example
VITE_API_URL=https://your-backend.railway.app

# server/.env.example
NODE_ENV=production
PORT=3001
SESSION_SECRET=your-secret-key
```

### 3. 添加README徽章
```markdown
[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/)
[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/)
```

### 4. 配置分析
- Vercel Analytics: 自动启用
- Railway Metrics: 查看资源使用情况

---

## 快速命令速查 📋

```bash
# 本地测试构建
cd client && npm run build
cd server && npm run build

# 查看构建产物
ls -la client/dist
ls -la server/dist

# 本地运行生产构建
cd server && NODE_ENV=production node dist/index.js

# 推送代码
git add .
git commit -m "update"
git push

# 查看Git状态
git status
git log --oneline -5
```

---

## 部署检查清单 ✅

部署前:
- [ ] 代码已提交到GitHub
- [ ] 所有依赖已添加到package.json
- [ ] 硬编码URL已替换为环境变量
- [ ] 本地构建测试通过

Railway (后端):
- [ ] 项目已创建
- [ ] Root Directory设置为 `server`
- [ ] 环境变量已配置
- [ ] 部署成功
- [ ] /health端点可访问
- [ ] 复制了后端URL

Vercel (前端):
- [ ] 项目已创建
- [ ] Root Directory设置为 `client`
- [ ] VITE_API_URL已配置
- [ ] 部署成功
- [ ] 前端页面可访问
- [ ] 复制了前端URL

测试:
- [ ] 前端可以打开
- [ ] 可以登录
- [ ] WebSocket连接正常
- [ ] 创建房间成功
- [ ] 加入房间成功
- [ ] 游戏流程正常

---

## 🎉 部署完成！

现在你的狼人杀游戏已经在线上运行了！

**分享链接给朋友开始游戏吧！** 🐺✨

---

## 需要帮助？

- 📖 查看完整文档: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- 🐛 报告问题: GitHub Issues
- 💬 讨论: GitHub Discussions
