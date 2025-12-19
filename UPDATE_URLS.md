# 更新硬编码URL指南 🔧

## 需要修改的文件清单

以下是所有需要更新的文件，将 `http://localhost:3001` 替换为 `${config.apiUrl}`

---

## 1. LoginPage.tsx ✅

**文件**: `client/src/pages/LoginPage.tsx`

### 修改位置1: 注册API (第19行)
```typescript
// 修改前
const response = await fetch('http://localhost:3001/api/auth/register', {

// 修改后
import { config } from '../config';
const response = await fetch(`${config.apiUrl}/api/auth/register`, {
```

### 修改位置2: 登录API (第48行)
```typescript
// 修改前
const response = await fetch('http://localhost:3001/api/auth/login', {

// 修改后
const response = await fetch(`${config.apiUrl}/api/auth/login`, {
```

---

## 2. websocket.ts ✅

**文件**: `client/src/services/websocket.ts`

### 需要大幅修改

```typescript
// 修改前
class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: ((message: ServerMessage) => void)[] = [];

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket...');
    this.socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
```

```typescript
// 修改后
import { config } from '../config';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: ((message: ServerMessage) => void)[] = [];

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to WebSocket...', config.apiUrl);
    this.socket = io(config.apiUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
```

---

## 3. 检查其他文件

使用VSCode全局搜索:

1. 按 `Ctrl + Shift + F`
2. 搜索: `localhost:3001`
3. 在 `client/src` 目录下
4. 查看是否还有其他文件需要修改

---

## 快速替换脚本

如果你使用的是 Unix/Linux/Mac，可以使用这个脚本:

```bash
#!/bin/bash

# 替换 LoginPage.tsx
sed -i "s|'http://localhost:3001/api/auth/register'|\`\${config.apiUrl}/api/auth/register\`|g" client/src/pages/LoginPage.tsx
sed -i "s|'http://localhost:3001/api/auth/login'|\`\${config.apiUrl}/api/auth/login\`|g" client/src/pages/LoginPage.tsx

# 替换 websocket.ts
sed -i "s|'http://localhost:3001'|config.apiUrl|g" client/src/services/websocket.ts

echo "URL替换完成！"
```

Windows PowerShell:
```powershell
# 需要手动修改，或使用编辑器的查找替换功能
```

---

## 修改步骤

### 步骤1: 在每个需要修改的文件顶部添加import

```typescript
import { config } from '../config';
```

### 步骤2: 替换URL

查找: `'http://localhost:3001'`
替换: `config.apiUrl`

注意：
- 如果在模板字符串中，使用 `${config.apiUrl}`
- 如果在普通字符串中，需要改成模板字符串或字符串拼接

### 步骤3: 测试

```bash
# 确保能够正常构建
cd client
npm run build

# 检查是否有TypeScript错误
npm run type-check
```

---

## 验证清单 ✅

- [ ] LoginPage.tsx 已添加 import config
- [ ] LoginPage.tsx 注册API已更新
- [ ] LoginPage.tsx 登录API已更新
- [ ] websocket.ts 已添加 import config
- [ ] websocket.ts WebSocket连接已更新
- [ ] 所有文件已保存
- [ ] 执行 `npm run build` 成功
- [ ] 提交到Git
- [ ] 推送到GitHub

---

## 完成后

```bash
# 提交更改
git add .
git commit -m "fix: 使用环境变量配置API地址"
git push

# Vercel会自动重新部署
# 等待1-2分钟后访问你的应用
```

---

**修改完成后，你的应用就可以在生产环境正常运行了！** 🎉
