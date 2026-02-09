# 后端测试审查报告：狼人杀 App

> 基准版本：2026-02-06 | 21 个测试文件 / 227 个用例 / 全部通过

## 一、当前测试状态

### 测试总览

| 分类 | 文件数 | 用例数 | 状态 |
|------|--------|--------|------|
| 单元测试 | 16 | 173 | 全部通过 |
| 集成测试 | 2 | 30 | 全部通过 |
| E2E 测试 | 3 | 24 | 全部通过 |
| **合计** | **21** | **227** | **全部通过** |

### 目录结构

```
server/src/test/
├── helpers/
│   ├── GameTestHelper.ts            # mock 工厂（createMockGame, createMockPlayer, createSkillEffect, createStandard12Players）
│   └── E2ETestFramework.ts          # E2E 执行器（E2ETestExecutor + ScenarioBuilder）
├── unit/
│   ├── skill/
│   │   └── SkillResolver.test.ts    # 22 用例  效果执行、优先级、守卫/摄梦人交互、连锁死亡
│   ├── voting/
│   │   └── VotingSystem.test.ts     # 21 用例  警长竞选状态机、放逐投票、PK、1.5x 权重、警徽管理
│   ├── roles/
│   │   ├── RoleRegistry.test.ts     # 3 用例   角色注册/查找
│   │   ├── WitchHandler.test.ts     # 7 用例   save/poison 资源、防重复提交
│   │   ├── GuardHandler.test.ts     # 5 用例   连续守护限制
│   │   ├── DreamerHandler.test.ts   # 5 用例   梦游/梦死/重置
│   │   ├── SeerHandler.test.ts      # 4 用例   查验结果准确性
│   │   ├── HunterHandler.test.ts    # 3 用例   死亡开枪、被毒不开枪
│   │   ├── WolfHandler.test.ts      # 4 用例   投票共识、目标记录
│   │   ├── NightmareHandler.test.ts # 3 用例   恐惧标记
│   │   ├── WhiteWolfHandler.test.ts # 3 用例   自爆、警徽状态
│   │   ├── KnightHandler.test.ts    # 3 用例   决斗（狼/好人）
│   │   └── WolfBeautyHandler.test.ts # 3 用例  魅惑连结
│   ├── script/
│   │   ├── ScriptValidator.test.ts  # 20 用例  9-18人范围、阵营平衡warning、角色存在性、组合警告
│   │   └── ScriptPhaseGenerator.test.ts # 35 用例  阶段生成
│   └── flow/
│       └── GameFlowEngine.test.ts   # 14 用例  阶段推进、结算触发、胜利判定
├── integration/
│   ├── GameSetup.test.ts            # 25 用例  建房→加人→分配→开始（全剧本）
│   └── ScriptPresets.test.ts        # 5 用例   预设数量、验证通过、狼人范围
└── e2e/
    ├── GameFlow.test.ts             # 14 用例  夜间行动、摄梦人梦死、狼美人魅惑、猎人开枪
    ├── smoke/
    │   └── SmokeTest.test.ts        # 2 用例   冒烟测试
    └── mechanics/
        └── ScenarioTest.test.ts     # 8 用例   女巫救/毒、守卫挡刀、石像鬼、胜利条件
```

### 覆盖分布

| 模块 | 单元测试 | 集成测试 | E2E | 覆盖评估 |
|------|---------|---------|-----|---------|
| SkillResolver | 22 用例 | — | 间接 | 基本覆盖，缺交互矩阵集成测试 |
| VotingSystem | 21 用例 | — | 间接 | 基本覆盖，缺完整流程 E2E |
| GameFlowEngine | 14 用例 | — | 间接 | 基本覆盖 |
| RoleHandler (×15) | 43 用例 | — | 间接 | 核心角色已覆盖，缺 Gargoyle/Gravekeeper/BlackWolf |
| ScriptValidator | 20 用例 | — | — | 充分 |
| ScriptPhaseGenerator | 35 用例 | — | — | 充分 |
| ScriptPresets | — | 5 用例 | — | 充分 |
| GameSetup (原 ScriptIntegration) | — | 25 用例 | — | 充分 |
| GameService | — | — | 间接 | **未覆盖**（无专属测试） |
| AuthService | — | — | — | **未覆盖** |
| SocketManager | — | — | — | **未覆盖** |
| 夜间结算全链路 | — | — | 间接 | **未覆盖**（无专属集成测试） |
| 白天结算全链路 | — | — | — | **未覆盖** |
| 胜利条件 | — | — | 部分 | 现有 E2E 通过篡改 alive 实现，非真实流程 |

---

## 二、待补充测试（实现方案）

### 执行顺序与依赖

```
P1:   夜间结算集成测试
 ↓
P2-d: 白天结算集成测试
 ↓
P2-a: 胜利条件 E2E 重写
 ↓
P2-b: 投票流程 E2E
 │
P2-c: GameService 集成测试（可独立）
 │
P3-a: AuthService 单元测试（可独立）
 │
P3-b: SocketManager 测试（依赖 Auth + GameService mock）
```

---

### P1: 夜间结算集成测试

**文件**: `test/integration/NightSettlement.test.ts` | **~15 用例**

**目标**: handler → SkillEffect → SkillResolver.resolve → Game state 全链路

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 狼刀+无守护 | `alive=false`, `outReason='wolf_kill'` |
| 2 | 守卫守护+狼刀同一人 | `protected[]` 含目标，`deaths` 空 |
| 3 | 女巫解药救狼刀目标 | `revives[]` 含目标，`deaths` 空 |
| 4 | 女巫毒药+守卫守护同一人 | 毒穿守卫，目标死亡 |
| 5 | 同守同救（奶穿） | 守卫+狼刀+女巫救 → 目标死亡（`guard_save_conflict`） |
| 6 | 摄梦人首次梦游 | `dreamProtected`，免疫所有伤害 |
| 7 | 摄梦人连续两晚同一人 | DREAM_KILL，目标梦死 |
| 8 | 噩梦之影恐惧预言家 | CHECK 效果被 blocked |
| 9 | 狼美人魅惑+被毒 | 连结目标殉情 |
| 10 | 猎人被狼刀 | `pendingEffects` 含 HUNTER_SHOOT |
| 11 | 猎人被毒 | `pendingEffects` 空 |
| 12 | 预言家查验狼人 | `data.result === 'wolf'` |
| 13 | 平安夜 | `deaths` 空 |
| 14 | 多人死亡 | `deaths` 含多个 ID |
| 15 | 守卫被恐惧后守护无效 | 守卫 effect blocked |

**实现**: 直接构造 SkillEffect → `addEffect()` → `resolve(game, 'night')`，不走 GameFlowEngine

---

### P2-a: 胜利条件 E2E 重写

**文件**: `test/e2e/WinCondition.test.ts` | **~6 用例**

**目标**: 通过真实游戏流程（多回合）自然触发胜利条件

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 好人胜-放逐完所有狼 | `game.winner === 'good'` |
| 2 | 狼人胜-屠杀至狼≥好 | `game.winner === 'wolf'` |
| 3 | 好人胜-女巫毒最后一狼 | 夜间结算后 winner |
| 4 | 狼人胜-连结死亡翻盘 | 狼美人殉情导致好人不足 |
| 5 | 好人胜-骑士决斗最后一狼 | 白天结算后 winner |
| 6 | 游戏继续 | `game.status === 'running'` |

**实现**: 用 E2ETestFramework 驱动多回合，手动指定 nightActions + 投票

---

### P2-b: 投票流程 E2E

**文件**: `test/e2e/VotingFlow.test.ts` | **~10 用例**

**目标**: 通过 GameService API 驱动完整投票流程

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 正常警长竞选 | signup → campaign → vote → tally → 当选 |
| 2 | 仅1人参选 | 自动当选 |
| 3 | 全部退出 | 无警长 |
| 4 | 平局-上帝指定 | godAssignSheriff |
| 5 | 平局-上帝销毁 | godAssignSheriff('none') |
| 6 | 正常放逐 | 投票 → tally → exile |
| 7 | 警长1.5x权重 | 权重改变投票结果 |
| 8 | 放逐平局-PK | PK 投票决出 |
| 9 | 全员弃票 | 无人出局 |
| 10 | PK再平 | 无人出局 |

---

### P2-c: GameService 集成测试

**文件**: `test/integration/GameService.test.ts` | **~12 用例**

**mock**: `fs/promises`

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | createGame | status='waiting'，roomCode 6位 |
| 2 | addPlayer ×12 | playerId 1-12 |
| 3 | addPlayer 超上限 | 返回 null |
| 4 | addPlayer 指定 playerId | 成功占座 |
| 5 | addPlayer 重复 userId | 返回已有 player |
| 6 | removePlayer | players 减少 |
| 7 | removePlayer 游戏进行中 | 返回 false |
| 8 | assignRoles | abilities 初始化 |
| 9 | assignRoles 无效 roleId | 返回 false |
| 10 | startGame | status='running', currentRound=1 |
| 11 | startGame 未分配角色 | 返回 false |
| 12 | deleteGame | getGame 返回 undefined |

---

### P2-d: 白天结算集成测试

**文件**: `test/integration/DaySettlement.test.ts` | **~8 用例**

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 投票放逐狼人 | `alive=false`, `outReason='exile'` |
| 2 | 放逐猎人→开枪 | pendingEffects → 开枪目标死亡 |
| 3 | 放逐警长→警徽流转 | `sheriffBadgeState='pending_transfer'` |
| 4 | 骑士决斗狼人 | 狼死，骑士活 |
| 5 | 骑士决斗好人 | 骑士死 |
| 6 | 放逐狼美人→连结死亡 | 连结目标殉情 |
| 7 | 放逐最后一狼 | `game.winner === 'good'` |
| 8 | 猎人开枪打死最后一狼 | 连锁触发好人胜 |

---

### P3-a: AuthService 单元测试

**文件**: `test/unit/auth/AuthService.test.ts` | **~10 用例**

**mock**: `fs/promises` + `bcryptjs`

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 正确密码登录 | 返回 UserSession |
| 2 | 错误密码 | 返回 null |
| 3 | 不存在用户 | 返回 null |
| 4 | logout | token 失效 |
| 5 | 有效 token | 返回 session |
| 6 | 过期 token | 返回 null |
| 7 | 不存在 token | 返回 null |
| 8 | register 新用户 | passwordHash 非明文 |
| 9 | register 重复用户名 | 返回 null |
| 10 | deleteUser | 删除成功 |

---

### P3-b: SocketManager 测试

**文件**: `test/integration/SocketManager.test.ts` | **~10 用例**

**策略**: socket.io-client + 真实 HTTP server，mock GameService/AuthService

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 连接 | 收到 CONNECTED |
| 2 | AUTH 有效 token | AUTH_SUCCESS |
| 3 | AUTH 无效 token | AUTH_FAILED |
| 4 | player 发 GOD 命令 | ERROR（权限不足） |
| 5 | god 发 GOD 命令 | 正常处理 |
| 6 | CREATE + JOIN | ROOM_JOINED |
| 7 | 加入不存在房间 | ERROR |
| 8 | 断线重连 | 收到完整 game state |
| 9 | 等待中断线 | 玩家被移除 |
| 10 | action 提交广播 | 全员收到 GAME_STATE_UPDATE |

---

## 三、预估完成后状态

| 分类 | 当前 | 新增 | 完成后 |
|------|------|------|--------|
| 单元测试 | 173 | +10 (Auth) | 183 |
| 集成测试 | 30 | +35 (夜结算15 + 白结算8 + GameService12) | 65 |
| E2E 测试 | 24 | +26 (胜利6 + 投票10 + Socket10) | 50 |
| **合计** | **227** | **+71** | **~298** |
