# 后端代码审查报告：狼人杀 App

> 基准版本：2026-02-06 | 15 个问题全部已修复

## 一、架构概览

后端采用 **TypeScript + Express + Socket.IO** 的 monorepo 架构：

```
SocketManager          消息路由 / 认证网关 / 断线重连
  └─ AuthService       登录/登出/Token 验证
  └─ GameService       游戏生命周期编排（CRUD + 持久化）
       └─ VotingSystem     警长竞选 + 放逐投票（无状态，操作 Game 对象）
       └─ GameFlowEngine   状态机 / 阶段推进 / 结算触发
            └─ SkillResolver    夜间/白天行动结算引擎（优先级队列）
       └─ BotService       bot 自动决策
  └─ ScriptService     剧本 CRUD + 验证
       └─ ScriptValidator   剧本配置校验（9-18人、角色存在性、阵营建议）
       └─ ScriptPresets     预设剧本库（7个：9/12/15/18人局）
```

**角色系统**: 15 个角色通过 `BaseRoleHandler` 策略模式实现，`RoleRegistry` 统一注册查找。

**技能系统**: `SkillEffect` 优先级队列 → `SkillResolver.resolve()` 按 priority 升序执行 → `SettleResult` 返回死亡/保护/复活/阻断结果。

## 二、已修复问题清单

以下 15 个问题在前一轮 review 中全部修复完毕，列出以供后续回归验证：

| # | 严重程度 | 问题 | 修复方案 |
|---|---------|------|---------|
| 1 | 严重 | VotingSystem 重复实例（GameService 和 GameFlowEngine 各创建一个） | GameFlowEngine 改为 DI 注入，GameService 传入共享实例 |
| 2 | 严重 | 狼刀效果被重复添加（每个狼人 submitAction 都产生 KILL 效果） | WolfHandler 不再创建 KILL 效果，仅记录 wolfKill 目标；GameFlowEngine 结算前统一创建单一狼刀效果 |
| 3 | 高危 | `removePlayer` 重新分配 playerId（破坏选座） | 删除重编号逻辑，玩家保持原始 ID |
| 4 | 高危 | WebSocket 消息缺少输入验证 | 添加消息结构验证 + playerId 身份校验 |
| 5 | 高危 | 文件持久化竞态条件 | saveGames() 改为 Promise 链串行化 |
| 6 | 中等 | 石像鬼 IMMUNE 死代码 | 删除 executeImmune、IMMUNE 枚举、gargoyleProtected |
| 7 | 中等 | 女巫死代码 + poison-then-save 漏洞 | 移除冗余判断，添加 witchSubmitted 防重复 |
| 8 | 中等 | 摄梦人守护与守卫不区分 | 新增 DREAM_PROTECT 效果类型 + executeDreamProtect；实现同守同救(奶穿)和摄梦人死亡连带 |
| 9 | 中等 | OUT_REASONS 与 DeathReason 命名不一致 | 统一使用 snake_case，补全缺失死因 |
| 10 | 中等 | 白狼王 sheriffPendingAssign 永远 false | 修改前保存 wasSheriff |
| 11 | 低 | 硬编码凭据 | 改为环境变量（ADMIN_PASSWORD、GOD_PASSWORD、TEST_PLAYER_PASSWORD） |
| 12 | 低 | 大量 DEBUG console.log | 删除所有 [DEBUG] 日志 |
| 13 | 低 | CORS origin: '*' | 改为 process.env.CORS_ORIGIN |
| 14 | 低 | 缺少游戏清理机制 | 新增 cleanupStaleGames()（完成24h/未完成48h） |
| 15 | 低 | Hunter/BlackWolf onDeath 从未调用 | 新增 processDeathTrigger() |

## 三、当前架构关键设计

### 3.1 技能优先级体系

```
100   FEAR              噩梦之影恐惧（最先执行）
150   GARGOYLE_CHECK    石像鬼查验
200   GUARD             守卫守护
210   DREAM             摄梦人守护/梦死
300   WOLF_KILL         狼刀
350   GRAVEKEEPER       守墓人验尸
400   WITCH_ANTIDOTE    女巫解药
410   WITCH_POISON      女巫毒药
500   SEER_CHECK        预言家查验
510   WOLF_BEAUTY       狼美人魅惑
```

### 3.2 关键技能交互规则

| 场景 | 结果 |
|------|------|
| 守卫守护 + 狼刀同一人 | 目标存活（挡刀） |
| 守卫守护 + 女巫毒同一人 | 目标死亡（毒穿守卫） |
| 摄梦人守护 + 狼刀/毒药 | 目标存活（免疫所有夜间伤害） |
| 守卫守护 + 狼刀 + 女巫救（同守同救/奶穿） | 目标死亡 |
| 摄梦人连续两晚同一人 | 目标梦死 |
| 摄梦人死亡 | 梦游目标连带死亡 |
| 狼美人死亡 | 魅惑目标殉情死亡 |
| 猎人被毒死 | 不能开枪 |
| 猎人被刀/被投 | 可以开枪（pendingEffects） |

### 3.3 验证规则（ScriptValidator）

| 类别 | 级别 | 规则 |
|------|------|------|
| 人数范围 | error | 9-18人 |
| playerCount 一致性 | error | roleComposition 总数必须等于 playerCount |
| 角色存在性 | error | 所有 roleId 必须在 RoleRegistry 中存在 |
| 至少1个狼人 | error | 必须包含狼人阵营角色 |
| 狼人数量建议 | warning | 按人数动态推荐（9人2-3狼，12人3-4狼，15人4-5狼，18人5-6狼） |
| 平民过少 | warning | 建议至少2个平民 |
| 缺少预言家/女巫 | warning | 建议配置 |
| 特殊狼人过多 | warning | 建议不超过 maxWolves/2 |
| 守卫同守/女巫同救毒 | warning | 规则变体提醒 |

### 3.4 持久化

| 数据 | 文件 | 机制 |
|------|------|------|
| 游戏状态 | data/games.json | Promise 链串行写入，启动时清理过期游戏 |
| 用户账号 | data/users.json | bcrypt 哈希密码 |
| 活跃会话 | data/sessions.json | Token + 过期时间，懒清理 |

## 四、已知待改进项

以下不是 bug，但值得在后续迭代中关注：

| 项目 | 说明 |
|------|------|
| 日志体系 | 当前无结构化日志，建议引入日志级别（debug/info/warn/error） |
| 错误处理 | SocketManager 各 handler 的 catch 块只返回 ERROR 消息，缺少错误分类 |
| 性能 | 每次操作写全量 games.json，游戏多时可能成为瓶颈 |
| 安全 | Token 为 UUID 明文存储（非 JWT），无签名验证 |
| SIX_PLAYER_SCRIPT | 静态属性仍在 ScriptPresets 中，但已从 getAllPresets() 移除，可考虑彻底删除 |

## 五、值得肯定的设计

- SkillPriority 优先级系统设计合理，数值排序清晰
- BaseRoleHandler 抽象类配合策略模式，角色扩展方便
- ScriptValidator 区分 error/warning 两级，上帝可自由配置
- VotingSystem 无状态设计，直接操作 Game 对象，测试友好
- SocketManager 断线重连支持，游戏进行中玩家数据保留
- GameReplayData 复盘数据结构设计完善
- GameFlowEngine DI 注入 VotingSystem，解耦清晰
