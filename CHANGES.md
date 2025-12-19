# 更新日志

## 本次更新内容（2024-12-18）

### ✨ 新增功能

#### 1. 默认上帝账号
- 系统启动时自动创建默认上帝账号
- 用户名：`god`
- 密码：`god`
- 文件位置：[server/src/services/AuthService.ts:87-102](server/src/services/AuthService.ts)

#### 2. 自动创建测试账号
- 系统启动时自动创建12个测试玩家账号
- 账号：`test1` ~ `test12`
- 密码：`test`
- 方便快速测试游戏流程
- 文件位置：[server/src/services/AuthService.ts:104-123](server/src/services/AuthService.ts)

#### 3. 玩家自注册功能
- 玩家可以在登录页面自行注册账号
- 注册后自动成为玩家角色
- 支持前后端：
  - 后端API：[server/src/index.ts:49-62](server/src/index.ts)
  - AuthService：[server/src/services/AuthService.ts:181-184](server/src/services/AuthService.ts)
  - 前端UI：[client/src/pages/LoginPage.tsx:13-40](client/src/pages/LoginPage.tsx)

#### 4. 随机角色分配功能
- 上帝控制台新增"🎲 随机分配"按钮
- 自动按照剧本配置随机分配角色
- 使用Fisher-Yates洗牌算法确保随机性
- 分配后可以手动调整
- 文件位置：[client/src/pages/GodConsole.tsx:74-99](client/src/pages/GodConsole.tsx)

#### 5. 角色分配界面优化
- 显示当前剧本的角色配置
- 清晰展示每个角色的数量和阵营
- 支持随机分配和手动分配两种方式
- 文件位置：[client/src/pages/GodConsole.tsx:291-313](client/src/pages/GodConsole.tsx)

### 📝 文档更新

#### 1. 详细使用指南
- 新增 `USER_GUIDE.md` - 完整的游戏使用指南
- 包含内容：
  - 快速开始流程
  - 账号说明
  - 详细游戏流程
  - 角色说明和技巧
  - 常见问题解答
  - 游戏技巧

#### 2. 快速开始指南
- 新增 `QUICK_START.md` - 5分钟快速上手指南
- 包含内容：
  - 启动服务步骤
  - 创建房间流程
  - 玩家加入步骤
  - 游戏流程速查表
  - 账号速查表
  - 角色速查表

#### 3. README更新
- 添加默认账号表格
- 更新使用流程说明
- 添加快速测试指南
- 更新功能特性列表

---

## 🔑 默认账号总览

系统启动后会自动创建以下账号：

| 角色 | 用户名 | 密码 | 用途 |
|-----|--------|------|------|
| 管理员 | `admin` | `admin123` | 管理用户和剧本 |
| 上帝 | `god` | `god` | 主持游戏 |
| 测试玩家1 | `test1` | `test` | 测试游戏 |
| 测试玩家2 | `test2` | `test` | 测试游戏 |
| 测试玩家3 | `test3` | `test` | 测试游戏 |
| 测试玩家4 | `test4` | `test` | 测试游戏 |
| 测试玩家5 | `test5` | `test` | 测试游戏 |
| 测试玩家6 | `test6` | `test` | 测试游戏 |
| 测试玩家7 | `test7` | `test` | 测试游戏 |
| 测试玩家8 | `test8` | `test` | 测试游戏 |
| 测试玩家9 | `test9` | `test` | 测试游戏 |
| 测试玩家10 | `test10` | `test` | 测试游戏 |
| 测试玩家11 | `test11` | `test` | 测试游戏 |
| 测试玩家12 | `test12` | `test` | 测试游戏 |

---

## 🎮 如何使用新功能

### 使用随机分配角色

1. 上帝创建房间，等待12名玩家加入
2. 点击"分配角色"按钮
3. 点击"🎲 随机分配"按钮
4. 系统自动随机分配所有角色
5. 如需调整，可以手动修改下拉框
6. 点击"确认分配"

### 使用测试账号

1. 打开12个浏览器标签页
2. 依次登录：
   - 标签1：test1 / test
   - 标签2：test2 / test
   - ...
   - 标签12：test12 / test
3. 所有玩家输入相同的房间码
4. 点击"加入房间"

### 玩家自注册

1. 打开登录页面
2. 点击"注册"标签
3. 输入用户名（唯一）
4. 输入密码（至少4位）
5. 点击"注册"按钮
6. 注册成功后，切换到"登录"标签登录

---

## 📂 修改的文件

### 后端文件

1. **server/src/services/AuthService.ts**
   - 添加 `ensureDefaultGod()` 方法
   - 添加 `ensureTestPlayers()` 方法
   - 添加 `register()` 方法
   - 在 `init()` 中调用新方法

2. **server/src/index.ts**
   - 添加 `/api/auth/register` 注册接口
   - 支持用户自注册

### 前端文件

1. **client/src/pages/LoginPage.tsx**
   - 添加登录/注册标签切换
   - 添加 `handleRegister()` 方法
   - 更新UI显示默认账号信息

2. **client/src/pages/GodConsole.tsx**
   - 添加 `handleRandomAssignRoles()` 方法
   - 更新角色分配对话框UI
   - 显示剧本配置信息
   - 添加随机分配按钮

### 文档文件

1. **USER_GUIDE.md** - 新增完整使用指南
2. **QUICK_START.md** - 新增快速开始指南
3. **README.md** - 更新项目说明
4. **CHANGES.md** - 本文档

---

## 🚀 下一步建议

现在你可以：

1. ✅ 启动服务器和客户端
2. ✅ 使用 god/god 登录上帝账号
3. ✅ 创建房间获得房间码
4. ✅ 使用 test1-test12 登录12个玩家账号
5. ✅ 所有玩家加入房间
6. ✅ 使用随机分配功能分配角色
7. ✅ 开始游戏并测试完整流程

详细步骤请参考：
- [QUICK_START.md](./QUICK_START.md) - 5分钟快速上手
- [USER_GUIDE.md](./USER_GUIDE.md) - 完整使用指南

---

**祝游戏愉快！** 🎉
