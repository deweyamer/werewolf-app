# 阿里云函数计算快速参考 ⚡

## 🚀 快速构建

### 后端镜像
```bash
cd werewolf-app/server
docker build -t werewolf-backend .
```

### 前端镜像
```bash
cd werewolf-app/client
docker build --build-arg VITE_API_URL=https://your-backend-url -t werewolf-frontend .
```

---

## 📤 推送到ACR

### 登录
```bash
docker login registry.cn-hangzhou.aliyuncs.com
```

### 标记并推送后端
```bash
docker tag werewolf-backend:latest registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest
docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest
```

### 标记并推送前端
```bash
docker tag werewolf-frontend:latest registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest
docker push registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest
```

---

## 🛠️ 使用构建脚本

### 一键构建所有
```bash
# 设置环境变量
export ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com
export ACR_NAMESPACE=werewolf-game
export VITE_API_URL=https://your-backend-fc-url

# 运行脚本
chmod +x build-all.sh
./build-all.sh
```

### 单独构建后端
```bash
chmod +x build-backend.sh
./build-backend.sh
```

### 单独构建前端
```bash
export VITE_API_URL=https://your-backend-url
chmod +x build-frontend.sh
./build-frontend.sh
```

---

## ⚙️ 函数计算配置速查

### 后端函数配置
- **镜像**: `registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest`
- **启动命令**: `node`
- **启动参数**: `["dist/index.js"]`
- **监听端口**: `3001`
- **内存**: `512 MB`
- **超时**: `300秒`

### 前端函数配置
- **镜像**: `registry.cn-hangzhou.aliyuncs.com/werewolf-game/frontend:latest`
- **启动命令**: `nginx`
- **启动参数**: `["-g", "daemon off;"]`
- **监听端口**: `80`
- **内存**: `256 MB`
- **超时**: `60秒`

---

## 🔍 测试命令

### 测试后端
```bash
# 健康检查
curl https://your-backend-fc-url/health

# 测试登录
curl -X POST https://your-backend-fc-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"god","password":"god"}'
```

### 测试前端
```bash
# 访问首页
curl https://your-frontend-fc-url/

# 健康检查
curl https://your-frontend-fc-url/health
```

---

## 📊 常用函数计算命令

### 使用Funcraft CLI

```bash
# 安装Funcraft
npm install @alicloud/fun -g

# 初始化配置
fun config

# 部署
fun deploy

# 查看日志
fun logs -t <service-name>/<function-name>

# 调用函数
fun invoke <service-name>/<function-name>
```

---

## 🔄 更新流程

1. 修改代码
2. 重新构建镜像
3. 推送到ACR
4. 在函数计算控制台点击"重新部署"

或使用自动化脚本：
```bash
./build-all.sh v1.1.0  # 指定版本
```

---

## 💰 成本优化

### 配置预留实例
- 避免冷启动
- 建议至少1个后端预留实例

### 调整内存配置
- 根据实际使用情况调整
- 后端: 256MB - 1024MB
- 前端: 128MB - 512MB

### 设置合理超时
- 后端: 300秒（支持长连接）
- 前端: 60秒

---

## 🐛 故障排查

### 镜像拉取失败
```bash
# 检查镜像是否存在
docker pull registry.cn-hangzhou.aliyuncs.com/werewolf-game/backend:latest

# 检查ACR访问权限
```

### 函数启动失败
```bash
# 查看函数日志
# 在函数计算控制台 → 函数详情 → 日志查询

# 检查环境变量是否正确
# 检查启动命令和参数
```

### WebSocket连接失败
- 确认HTTP触发器支持WebSocket
- 超时时间设置足够长（建议600秒）
- 检查CORS配置

---

## 📝 Dockerfile位置

```
werewolf-app/
├── server/
│   └── Dockerfile          # 后端Docker配置
├── client/
│   ├── Dockerfile          # 前端Docker配置
│   └── nginx.conf          # Nginx配置
├── build-backend.sh        # 后端构建脚本
├── build-frontend.sh       # 前端构建脚本
└── build-all.sh           # 完整构建脚本
```

---

## 🌐 访问URL格式

### 函数计算默认域名
```
https://<account-id>.<region>.fc.aliyuncs.com/2016-08-15/proxy/<service>/<function>/
```

### 自定义域名（推荐）
```
前端: https://game.yourdomain.com
后端: https://api.yourdomain.com
```

---

## 📚 相关资源

- [完整部署文档](./ALIYUN_FC_DEPLOYMENT.md)
- [阿里云函数计算](https://fc.console.aliyun.com/)
- [阿里云容器镜像](https://cr.console.aliyun.com/)
- [Funcraft工具](https://github.com/alibaba/funcraft)

---

**保存此文档作为快速参考！** 📌
