# 🐳 Docker本地部署指南

## 为什么选择Docker部署？

- ✅ **一键部署**：无需安装Node.js、npm等环境
- ✅ **环境隔离**：不会影响系统其他软件
- ✅ **跨平台**：Windows、Mac、Linux都能用
- ✅ **易于管理**：启动、停止、重启都很简单
- ✅ **数据持久化**：游戏数据不会丢失

---

## 📋 前置要求

### 安装Docker

#### Windows
1. 下载Docker Desktop: https://www.docker.com/products/docker-desktop
2. 双击安装
3. 重启电脑
4. 打开Docker Desktop，等待启动完成

#### Mac
```bash
# 使用Homebrew安装
brew install --cask docker
```

#### Linux (Ubuntu/Debian)
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo apt-get install docker-compose-plugin

# 添加当前用户到docker组
sudo usermod -aG docker $USER
newgrp docker
```

### 验证安装
```bash
docker --version
docker-compose --version
```

应该看到类似输出：
```
Docker version 24.0.7
Docker Compose version v2.23.0
```

---

## 🚀 快速开始（3分钟）

### 方法1：使用Docker Compose（推荐）⭐

```bash
# 1. 进入项目目录
cd werewolf-app

# 2. 一键启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 等待启动完成（约30秒）
# 看到以下信息表示成功：
# werewolf-game | 🎮 Werewolf Server is running on port 3001
```

访问: **http://localhost:3000**

### 方法2：使用Docker命令

```bash
# 1. 构建镜像
docker build -t werewolf-game .

# 2. 运行容器
docker run -d \
  --name werewolf-game \
  -p 3000:80 \
  -v $(pwd)/data:/app/server/data \
  werewolf-game

# 3. 查看日志
docker logs -f werewolf-game
```

访问: **http://localhost:3000**

---

## 📦 Docker镜像说明

### 镜像架构

```
werewolf-game:latest (总大小约150MB)
├── Node.js 18 Alpine (基础镜像)
├── Nginx (前端服务器)
├── 后端服务 (Node.js + Express + Socket.IO)
└── 前端应用 (React + TypeScript 编译后)
```

### 多阶段构建优化

1. **阶段1**: 构建后端 (server-builder)
2. **阶段2**: 构建前端 (client-builder)
3. **阶段3**: 生产环境 (最终镜像)

只保留运行时必需的文件，大幅减小镜像体积。

---

## 🔧 配置说明

### Docker Compose配置 (docker-compose.yml)

```yaml
services:
  werewolf-app:
    build:
      context: .
      dockerfile: Dockerfile
    image: werewolf-game:latest
    container_name: werewolf-game
    restart: unless-stopped  # 自动重启
    ports:
      - "3000:80"  # 本地端口:容器端口
    volumes:
      - ./data:/app/server/data  # 数据持久化
    environment:
      - NODE_ENV=production
      - PORT=3001
```

### 端口映射

| 本地端口 | 容器端口 | 服务 |
|---------|---------|------|
| 3000 | 80 | Nginx (前端+反向代理) |
| - | 3001 | Node.js后端 (容器内部) |

**说明**：
- 前端和后端都通过 `localhost:3000` 访问
- Nginx自动将 `/api` 和 `/socket.io` 请求代理到后端

### 数据持久化

```bash
# 数据存储位置
werewolf-app/data/
├── users.json      # 用户数据
├── sessions.json   # 会话数据
└── games.json      # 游戏记录
```

容器删除后，数据不会丢失！

---

## 🎮 使用说明

### 启动游戏

```bash
# 前台运行（可以看到日志）
docker-compose up

# 后台运行
docker-compose up -d
```

### 停止游戏

```bash
docker-compose down
```

### 重启游戏

```bash
docker-compose restart
```

### 查看日志

```bash
# 查看所有日志
docker-compose logs

# 实时跟踪日志
docker-compose logs -f

# 只看最近100行
docker-compose logs --tail=100
```

### 查看状态

```bash
docker-compose ps
```

输出：
```
NAME              IMAGE                   STATUS          PORTS
werewolf-game     werewolf-game:latest    Up 2 minutes    0.0.0.0:3000->80/tcp
```

### 进入容器

```bash
# 进入容器shell
docker exec -it werewolf-game sh

# 查看文件
ls -la /app

# 退出
exit
```

---

## 🔄 更新应用

### 方法1：重新构建

```bash
# 1. 停止并删除容器
docker-compose down

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 启动新容器
docker-compose up -d
```

### 方法2：拉取最新代码

```bash
# 1. 更新代码
git pull

# 2. 重新构建并启动
docker-compose up -d --build
```

---

## 📊 监控和维护

### 健康检查

Docker会自动检查应用健康状态：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' werewolf-game
```

状态：
- `healthy` - 运行正常 ✅
- `unhealthy` - 运行异常 ❌
- `starting` - 启动中 🟡

### 查看资源使用

```bash
# 查看CPU、内存使用
docker stats werewolf-game
```

输出：
```
CONTAINER ID   NAME            CPU %   MEM USAGE / LIMIT   MEM %
abc123def456   werewolf-game   2.5%    150MB / 2GB         7.5%
```

### 清理资源

```bash
# 删除停止的容器
docker-compose down

# 删除镜像
docker rmi werewolf-game

# 清理所有未使用的资源
docker system prune -a
```

---

## 🌐 网络配置

### 局域网访问

其他设备访问你的游戏：

1. 查看本机IP地址：
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
# 或
ip addr show
```

2. 假设本机IP是 `192.168.1.100`

3. 其他设备访问: `http://192.168.1.100:3000`

### 修改端口

编辑 `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # 改为8080端口
```

然后重启：
```bash
docker-compose down
docker-compose up -d
```

访问: `http://localhost:8080`

---

## 🔒 安全建议

### 修改默认账号

首次部署后：

1. 登录管理员账号: `admin` / `admin123`
2. 修改密码
3. 登录上帝账号: `god` / `god`
4. 修改密码

### 防火墙配置

如果需要外网访问：

```bash
# Linux防火墙开放端口
sudo ufw allow 3000/tcp
```

**注意**：外网访问需要配置路由器端口转发！

---

## 🐛 故障排查

### 问题1: 端口被占用

**错误**:
```
Error: bind: address already in use
```

**解决**:
```bash
# 查看占用3000端口的进程
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000

# 杀死进程或修改docker-compose.yml中的端口
```

### 问题2: 构建失败

**错误**:
```
ERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully
```

**解决**:
```bash
# 清理缓存重新构建
docker-compose build --no-cache
```

### 问题3: 容器启动失败

**查看详细日志**:
```bash
docker-compose logs
docker inspect werewolf-game
```

**常见原因**:
- 端口冲突
- 磁盘空间不足
- 权限问题

### 问题4: 健康检查失败

**检查**:
```bash
# 进入容器
docker exec -it werewolf-game sh

# 测试健康端点
curl http://localhost/health

# 查看nginx状态
ps aux | grep nginx

# 查看node进程
ps aux | grep node
```

### 问题5: 数据丢失

**确保数据卷正确挂载**:
```bash
# 检查挂载
docker inspect werewolf-game | grep -A 10 Mounts

# 确认数据文件存在
ls -la ./data
```

---

## 📈 性能优化

### 限制资源使用

编辑 `docker-compose.yml`:

```yaml
services:
  werewolf-app:
    # ... 其他配置 ...
    deploy:
      resources:
        limits:
          cpus: '1.0'      # 限制CPU
          memory: 512M     # 限制内存
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 使用国内镜像源加速构建

创建 `.npmrc`:
```
registry=https://registry.npmmirror.com
```

---

## 🔁 备份和恢复

### 备份数据

```bash
# 方法1: 直接复制data目录
cp -r ./data ./data-backup-$(date +%Y%m%d)

# 方法2: 导出容器数据
docker cp werewolf-game:/app/server/data ./data-backup
```

### 恢复数据

```bash
# 停止容器
docker-compose down

# 恢复数据
cp -r ./data-backup/* ./data/

# 启动容器
docker-compose up -d
```

---

## 📋 常用命令速查

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 重新构建
docker-compose build --no-cache

# 进入容器
docker exec -it werewolf-game sh

# 查看资源
docker stats werewolf-game

# 清理
docker-compose down
docker system prune -a
```

---

## 🎯 推荐配置

### 开发环境

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  werewolf-app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    volumes:
      - ./data:/app/server/data
      - ./server/src:/app/server/src  # 开发时挂载源码
    environment:
      - NODE_ENV=development
```

使用：
```bash
docker-compose -f docker-compose.dev.yml up
```

### 生产环境

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  werewolf-app:
    image: werewolf-game:latest
    restart: always  # 总是重启
    ports:
      - "80:80"  # 使用80端口
    volumes:
      - /var/werewolf/data:/app/server/data
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
```

---

## 🚢 部署到服务器

### 1. 导出镜像

在本地：
```bash
# 构建镜像
docker-compose build

# 导出镜像
docker save werewolf-game:latest | gzip > werewolf-game.tar.gz
```

### 2. 上传到服务器

```bash
scp werewolf-game.tar.gz user@your-server:/path/to/
```

### 3. 在服务器上导入

```bash
# 解压并导入
gunzip -c werewolf-game.tar.gz | docker load

# 运行
docker run -d \
  --name werewolf-game \
  --restart always \
  -p 80:80 \
  -v /var/werewolf/data:/app/server/data \
  werewolf-game:latest
```

---

## 🎉 总结

Docker部署优点：
- ✅ 一键启动，环境隔离
- ✅ 跨平台支持
- ✅ 数据持久化
- ✅ 易于维护和更新
- ✅ 资源可控

**现在您可以在任何支持Docker的机器上运行狼人杀游戏了！** 🐺✨

---

## 📚 相关文档

- [快速开始](./QUICK_START.md) - 本地开发环境
- [部署指南](./DEPLOYMENT_GUIDE.md) - 云服务部署
- [用户指南](./USER_GUIDE.md) - 游戏使用说明

---

**祝您游戏愉快！** 🎮
