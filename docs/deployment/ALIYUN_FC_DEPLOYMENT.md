# 阿里云函数计算部署指南 ☁️

## 📋 概述

本指南教您如何将狼人杀游戏分别部署到阿里云函数计算（前后端独立部署）。

### 架构图

```
┌─────────────────────────────────────────┐
│         阿里云函数计算                    │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐   ┌──────────────┐   │
│  │   前端服务    │   │   后端服务    │   │
│  │  (Nginx)     │   │  (Node.js)   │   │
│  │  端口: 80    │   │  端口: 3001  │   │
│  └──────┬───────┘   └──────┬───────┘   │
│         │                  │           │
│         │    HTTP/WS       │           │
│         └──────────────────┘           │
└─────────────────────────────────────────┘
```

---

## 🎯 前置准备

### 1. 阿里云账号
- 注册：https://www.aliyun.com/
- 开通函数计算服务
- 开通容器镜像服务ACR

### 2. 本地环境
- Docker Desktop
- 阿里云CLI（可选）
- Git

### 3. 获取AccessKey
1. 登录阿里云控制台
2. 点击右上角头像 → AccessKey管理
3. 创建AccessKey
4. **保存好AccessKey ID和Secret**

---

## 📦 第一步：构建Docker镜像

### 后端镜像构建

```bash
# 1. 进入后端目录
cd werewolf-app/server

# 2. 构建后端镜像
docker build -t werewolf-backend:latest .

# 3. 测试本地运行
docker run -d -p 3001:3001 --name werewolf-backend werewolf-backend:latest

# 4. 测试健康检查
curl http://localhost:3001/health
# 应该返回: {"status":"ok"}

# 5. 停止测试容器
docker stop werewolf-backend && docker rm werewolf-backend
```

### 前端镜像构建

```bash
# 1. 进入前端目录
cd werewolf-app/client

# 2. 构建前端镜像（指定后端API地址）
docker build \
  --build-arg VITE_API_URL=https://your-backend.fc.aliyuncs.com \
  -t werewolf-frontend:latest .

# 3. 测试本地运行
docker run -d -p 8080:80 --name werewolf-frontend werewolf-frontend:latest

# 4. 测试访问
curl http://localhost:8080/health
# 打开浏览器: http://localhost:8080

# 5. 停止测试容器
docker stop werewolf-frontend && docker rm werewolf-frontend
```

---

## 🚀 第二步：推送到阿里云容器镜像服务

### 1. 登录ACR

```bash
# 替换为你的ACR地址
docker login --username=your-username registry.cn-hangzhou.aliyuncs.com
# 输入密码（设置镜像仓库时的密码）
```

### 2. 创建镜像仓库

访问：https://cr.console.aliyun.com/

1. 创建命名空间：`werewolf-game`
2. 创建仓库：
   - 仓库名称：`backend`
   - 仓库类型：私有
   - 代码源：本地仓库
3. 再创建一个仓库：`frontend`

### 3. 标记并推送后端镜像

```bash
# 标记镜像（替换为你的ACR地址）
docker tag werewolf-backend:latest \
  registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest

# 推送到ACR
docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest
```

### 4. 标记并推送前端镜像

```bash
# 标记镜像
docker tag werewolf-frontend:latest \
  registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest

# 推送到ACR
docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest
```

---

## ⚙️ 第三步：在函数计算创建服务

### 1. 创建后端服务

访问：https://fc.console.aliyun.com/

#### 创建服务

1. 点击"创建服务"
2. 服务名称：`werewolf-backend-service`
3. 服务描述：狼人杀后端服务
4. 日志配置：启用（推荐）
5. VPC配置：根据需要选择

#### 创建后端函数

1. 点击"创建函数"
2. 基本配置：
   - 函数名称：`werewolf-backend`
   - 请求处理程序类型：处理HTTP请求
   - 运行环境：自定义容器镜像

3. 容器镜像配置：
   - 镜像地址：`registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest`
   - 镜像加速：开启
   - 容器启动命令：`node`
   - 容器启动参数：`["dist/index.js"]`
   - 监听端口：`3001`

4. 实例配置：
   - 内存规格：512 MB（推荐）
   - 实例并发度：10
   - 执行超时时间：300秒

5. 环境变量：
   ```
   NODE_ENV=production
   PORT=3001
   ```

6. 触发器配置：
   - 触发器类型：HTTP触发器
   - 认证方式：anonymous（匿名）
   - 请求方式：GET, POST, PUT, DELETE
   - 触发器名称：http-trigger

7. 点击"创建"

#### 获取后端访问地址

创建完成后，会生成一个公网访问地址，类似：
```
https://xxxxxx.cn-hangzhou.fc.aliyuncs.com/2016-08-15/proxy/werewolf-backend-service/werewolf-backend/
```

**记住这个地址！** 前端需要用到。

---

### 2. 创建前端服务

#### 重新构建前端镜像（使用正确的后端地址）

```bash
cd werewolf-app/client

# 使用实际的后端地址重新构建
docker build \
  --build-arg VITE_API_URL=https://xxxxxx.cn-hangzhou.fc.aliyuncs.com/2016-08-15/proxy/werewolf-backend-service/werewolf-backend \
  -t werewolf-frontend:latest .

# 重新标记并推送
docker tag werewolf-frontend:latest \
  registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest

docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest
```

#### 创建服务

1. 服务名称：`werewolf-frontend-service`
2. 其他配置同后端

#### 创建前端函数

1. 函数名称：`werewolf-frontend`
2. 容器镜像配置：
   - 镜像地址：`registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest`
   - 容器启动命令：`nginx`
   - 容器启动参数：`["-g", "daemon off;"]`
   - 监听端口：`80`

3. 实例配置：
   - 内存规格：256 MB
   - 实例并发度：20

4. 触发器：HTTP触发器（同后端）

5. 点击"创建"

#### 获取前端访问地址

```
https://yyyyyy.cn-hangzhou.fc.aliyuncs.com/2016-08-15/proxy/werewolf-frontend-service/werewolf-frontend/
```

---

## 🔒 第四步：配置CORS

在后端代码中已经配置了CORS，但如果遇到跨域问题，可以在函数计算控制台配置：

1. 进入后端函数 → 配置 → 环境变量
2. 添加：
```
ALLOWED_ORIGINS=https://yyyyyy.cn-hangzhou.fc.aliyuncs.com
```

然后修改 `server/src/index.ts`：
```typescript
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

---

## 🎮 第五步：测试部署

### 1. 测试后端

```bash
# 健康检查
curl https://xxxxxx.fc.aliyuncs.com/.../health

# 测试登录API
curl -X POST https://xxxxxx.fc.aliyuncs.com/.../api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"god","password":"god"}'
```

### 2. 测试前端

浏览器访问前端地址，应该能看到登录页面。

### 3. 完整流程测试

1. 登录上帝账号
2. 创建房间
3. 登录12个玩家账号
4. 加入房间
5. 分配角色
6. 开始游戏

---

## 💰 成本估算

### 函数计算计费

- **调用次数**：前100万次/月 免费
- **执行时长**：
  - 后端：512MB × 每次100ms = 约0.00001元/次
  - 前端：256MB × 每次50ms = 约0.000005元/次

### 示例成本（按1000人同时在线）

- 请求数：约100万次/天
- 每月费用：约50-100元

**远比购买服务器便宜！**

---

## 📊 监控和日志

### 查看日志

1. 进入函数详情页
2. 点击"日志查询"
3. 可以看到函数执行日志

### 配置告警

1. 进入"云监控"
2. 创建报警规则
3. 监控指标：
   - 函数错误率
   - 函数执行时长
   - 函数调用次数

---

## 🔄 更新部署

### 更新后端

```bash
# 1. 修改代码
cd werewolf-app/server

# 2. 重新构建
docker build -t werewolf-backend:latest .

# 3. 推送新镜像
docker tag werewolf-backend:latest \
  registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest
docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest

# 4. 在函数计算控制台点击"重新部署"或等待自动更新
```

### 更新前端

同理，重新构建并推送前端镜像。

---

## 🌐 绑定自定义域名

### 1. 准备域名

- 需要已备案的域名

### 2. 在函数计算配置

1. 进入服务 → 域名管理
2. 添加自定义域名：
   - 前端：`game.yourdomain.com`
   - 后端：`api.yourdomain.com`

3. 配置路由：
   - 路径：`/*`
   - 函数：选择对应的函数

### 3. 配置DNS解析

在域名服务商添加CNAME记录：
```
game.yourdomain.com  →  yyyyyy.cn-hangzhou.fc.aliyuncs.com
api.yourdomain.com   →  xxxxxx.cn-hangzhou.fc.aliyuncs.com
```

### 4. 配置HTTPS

函数计算自动提供免费SSL证书。

---

## ⚠️ 常见问题

### Q1: 冷启动慢怎么办？

**A**: 配置预留实例：
1. 进入函数配置
2. 弹性伸缩 → 预留实例
3. 设置至少1个预留实例

### Q2: WebSocket连接失败？

**A**: 函数计算HTTP触发器支持WebSocket，确保：
1. 触发器配置了WebSocket支持
2. 超时时间足够长（建议600秒）

### Q3: 镜像拉取失败？

**A**:
1. 检查ACR访问权限
2. 确认函数计算有ACR访问授权
3. 使用镜像加速

### Q4: 跨域错误？

**A**:
1. 检查后端CORS配置
2. 确认前端API地址正确
3. 查看浏览器控制台详细错误

### Q5: 数据如何持久化？

**A**: 函数计算是无状态的，需要：
1. 使用阿里云表格存储（推荐）
2. 或使用OSS对象存储
3. 或使用RDS数据库

---

## 📋 构建脚本

为了简化构建过程，创建脚本：

### build-and-push.sh

```bash
#!/bin/bash

# 配置
ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="werewolf-game"
BACKEND_API_URL="https://xxxxxx.fc.aliyuncs.com/..."

echo "🐺 开始构建狼人杀镜像..."

# 构建后端
echo "📦 构建后端镜像..."
cd server
docker build -t werewolf-backend:latest .
docker tag werewolf-backend:latest $ACR_REGISTRY/$NAMESPACE/backend:latest
docker push $ACR_REGISTRY/$NAMESPACE/backend:latest
echo "✅ 后端镜像推送成功"

# 构建前端
echo "📦 构建前端镜像..."
cd ../client
docker build --build-arg VITE_API_URL=$BACKEND_API_URL -t werewolf-frontend:latest .
docker tag werewolf-frontend:latest $ACR_REGISTRY/$NAMESPACE/frontend:latest
docker push $ACR_REGISTRY/$NAMESPACE/frontend:latest
echo "✅ 前端镜像推送成功"

echo "🎉 全部完成！"
```

使用：
```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

---

## 🎯 最佳实践

1. **使用预留实例** - 避免冷启动
2. **配置日志** - 方便调试
3. **启用监控告警** - 及时发现问题
4. **使用自定义域名** - 更专业
5. **数据持久化** - 使用表格存储或RDS
6. **定期备份** - 导出游戏数据
7. **版本管理** - 镜像打tag标记版本

---

## 📚 相关文档

- [阿里云函数计算文档](https://help.aliyun.com/product/50980.html)
- [容器镜像服务文档](https://help.aliyun.com/product/60716.html)
- [Docker部署指南](./DOCKER_DEPLOYMENT.md)
- [完整部署指南](./DEPLOYMENT_GUIDE.md)

---

## 🎉 总结

通过阿里云函数计算部署的优势：
- ✅ 按量付费，成本可控
- ✅ 自动伸缩，无需运维
- ✅ 高可用，自动容灾
- ✅ 秒级部署，快速迭代

**现在开始部署你的狼人杀游戏到阿里云吧！** ☁️✨
