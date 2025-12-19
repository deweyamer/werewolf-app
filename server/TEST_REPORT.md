# 狼人杀游戏测试报告

## 测试概览

**总测试数**: 99 个测试
**通过率**: 100%
**测试框架**: Vitest 4.0.16

---

## 测试模块详情

### 1. ScriptPhaseGenerator 测试 (16 tests)
**文件**: `src/game/script/ScriptPhaseGenerator.test.ts`

测试游戏阶段生成器，验证：
- ✅ 正确生成标准游戏阶段配置
- ✅ 夜间阶段按优先级排序（fear < gargoyle < guard < wolf < witch < seer）
- ✅ 石像鬼查验阶段位于守卫和狼刀之前
- ✅ 动态生成：只包含剧本中存在的角色阶段
- ✅ 规则变体支持（跳过警长竞选）
- ✅ 循环机制正确（lobby、夜间、结算、白天、投票）

**关键验证**:
- 石像鬼（独狼）优先级150，在守卫（200）和狼刀（300）之前
- 夜间角色阶段按技能优先级正确排序
- 不同剧本生成不同的阶段配置

---

### 2. RoleRegistry 测试 (3 tests)
**文件**: `src/game/roles/RoleRegistry.test.ts`

测试角色注册表，验证：
- ✅ 所有角色都正确注册（14个角色）
- ✅ 支持通过 roleId 和 roleName 查询
- ✅ 正确识别角色阵营（wolf/good）

**已注册角色**:
- 好人: seer, witch, hunter, guard, gravekeeper, knight, dreamer, villager
- 狼人: wolf, nightmare, wolf_beauty, white_wolf, black_wolf, gargoyle

---

### 3. ScriptValidator 测试 (17 tests)
**文件**: `src/game/script/ScriptValidator.test.ts`

测试剧本验证器，验证：
- ✅ 玩家总数必须为12人
- ✅ 阵营平衡必须为4狼8好
- ✅ 所有角色必须在 RoleRegistry 中存在
- ✅ 建议配置：4神4民（警告但不阻止）
- ✅ 规则变体验证

**验证规则**:
- 必须满足：12人、4狼8好、角色存在
- 警告提示：神职/民数不符合推荐配置

---

### 4. ScriptPresets 测试 (38 tests)
**文件**: `src/game/script/ScriptPresets.test.ts`

测试预设剧本库，验证：

#### 4.1 基础功能 (6 tests)
- ✅ 返回3个预设剧本
- ✅ 所有剧本有唯一ID
- ✅ 可通过ID获取剧本
- ✅ 不存在的ID返回undefined

#### 4.2 摄梦人剧本 (8 tests)
**配置**: nightmare×1 + wolf×3 + dreamer×1 + seer×1 + witch×1 + hunter×1 + villager×4
- ✅ 通过剧本验证
- ✅ 角色配置正确
- ✅ 4狼8好平衡
- ✅ 摄梦人连续两晚梦死规则
- ✅ 生成完整阶段配置
- ✅ 标记为medium难度
- ✅ 包含合适标签

#### 4.3 骑士狼美人剧本 (8 tests)
**配置**: wolf×3 + wolf_beauty×1 + knight×1 + seer×1 + witch×1 + guard×1 + villager×4
- ✅ 通过剧本验证
- ✅ 角色配置正确
- ✅ 4狼8好平衡
- ✅ 守卫不能连续守护同一人
- ✅ 生成完整阶段配置
- ✅ 标记为hard难度
- ✅ 包含合适标签

#### 4.4 守墓人石像鬼剧本 (8 tests)
**配置**: wolf×3 + gargoyle×1 + gravekeeper×1 + seer×1 + witch×1 + hunter×1 + villager×4
- ✅ 通过剧本验证
- ✅ 角色配置正确（包含4个平民）
- ✅ 4狼8好平衡（石像鬼是狼阵营）
- ✅ 生成完整阶段配置
- ✅ 标记为hard难度
- ✅ 包含合适标签（独狼）

**重点**: 石像鬼作为独狼，属于狼阵营，不参与狼刀，每晚可查验具体角色

#### 4.5 通用验证 (5 tests)
- ✅ 所有剧本有完整元数据
- ✅ 所有剧本通过验证
- ✅ 所有剧本能生成阶段配置
- ✅ 所有剧本都是12人
- ✅ 所有剧本都是4狼8好

#### 4.6 差异性验证 (3 tests)
- ✅ 每个剧本有独特的角色组合
- ✅ 摄梦人剧本包含dreamer和nightmare
- ✅ 骑士狼美人剧本包含knight和wolf_beauty
- ✅ 守墓人石像鬼剧本包含gravekeeper和gargoyle

---

### 5. ScriptIntegration 测试 (25 tests)
**文件**: `src/game/script/ScriptIntegration.test.ts`

集成测试，验证完整游戏流程：

#### 5.1 摄梦人剧本集成测试 (3 tests)
- ✅ 能创建游戏并正确分配角色
- ✅ 包含摄梦人和噩梦之影
- ✅ 有正确的角色数量

#### 5.2 骑士狼美人剧本集成测试 (3 tests)
- ✅ 能创建游戏并正确分配角色
- ✅ 包含骑士和狼美人
- ✅ 有正确的角色数量

#### 5.3 守墓人石像鬼剧本集成测试 (4 tests)
- ✅ 能创建游戏并正确分配角色
- ✅ 包含守墓人和石像鬼
- ✅ 石像鬼是狼阵营（验证狼人数量为4）
- ✅ 有正确的角色数量

#### 5.4 所有剧本通用集成测试 (12 tests)
每个剧本（3个）× 4个测试：
- ✅ 能开始游戏（状态变为running）
- ✅ 多次随机分配都应该满足要求（测试10次）
- ✅ 每个玩家有唯一的playerId
- ✅ 所有玩家有角色和阵营

#### 5.5 角色分配边界测试 (3 tests)
- ✅ 不应该允许在游戏已开始后分配角色
- ✅ 不应该允许分配不存在的角色
- ✅ 不应该允许分配剧本中不存在的角色

**集成测试亮点**:
- Fisher-Yates 洗牌算法随机分配角色
- 验证角色数量、阵营平衡、唯一性
- 测试多次随机分配的稳定性
- 边界条件和错误处理

---

## 测试性能

| 测试模块 | 测试数 | 耗时 |
|---------|-------|------|
| ScriptPhaseGenerator | 16 | 16ms |
| RoleRegistry | 3 | 9ms |
| ScriptValidator | 17 | 14ms |
| ScriptPresets | 38 | 19ms |
| ScriptIntegration | 25 | 4539ms |
| **总计** | **99** | **~4.6s** |

---

## 关键修复记录

### 1. RoleRegistry 双索引支持
**问题**: 原本只支持 roleName 查询
**修复**: 添加 `handlersById` 和 `handlersByName` 双索引
**影响**: 支持新剧本系统使用 roleId 查询

### 2. VillagerHandler 补全属性
**问题**: 缺少 `camp`, `hasDayAction`, `hasDeathTrigger` 属性
**修复**: 添加所有必需的 BaseRoleHandler 属性
**影响**: 验证器能正确识别平民阵营

### 3. 石像鬼角色重构
**问题**: 原本设计为好人阵营的石化保护角色
**用户反馈**: "石像鬼是狼队大哥，他在小狼没死完的时候不带刀，也不与小狼夜晚见面，但是他每晚可以查验每个人的具体角色"
**修复**:
- 改为狼阵营（camp: 'wolf'）
- 改为查验能力（SkillEffectType.CHECK）
- 添加 GARGOYLE_CHECK 优先级（150）
- 更新守墓人石像鬼剧本配置和规则

### 4. 守墓人石像鬼剧本平衡修正
**问题**: 石像鬼变为狼阵营后，配置不平衡
**修复**:
- 移除 white_wolf（白狼王）
- 平民数量从3改为4
- 最终配置：gargoyle×1 + wolf×3（4狼） + gravekeeper×1 + seer×1 + witch×1 + hunter×1 + villager×4（8好）

---

## 测试覆盖范围

### 单元测试
- ✅ 角色注册表
- ✅ 剧本验证器
- ✅ 阶段生成器
- ✅ 预设剧本库

### 集成测试
- ✅ 游戏创建
- ✅ 玩家加入
- ✅ 角色随机分配
- ✅ 游戏开始
- ✅ 阵营平衡验证
- ✅ 边界条件测试

### 测试技术
- Fisher-Yates 洗牌算法
- 多次随机测试（10次循环）
- 边界条件验证
- 错误处理测试

---

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- ScriptIntegration.test.ts

# 监听模式
npm run test:watch

# UI 模式
npm run test:ui

# 覆盖率报告
npm run test:coverage
```

---

## 结论

✅ **所有99个测试通过**
✅ **覆盖核心功能和边界情况**
✅ **验证新剧本系统的正确性**
✅ **石像鬼独狼机制测试通过**
✅ **3个预设剧本集成测试全部通过**

测试确保了：
1. 剧本系统的稳定性和可靠性
2. 角色分配的正确性和随机性
3. 阵营平衡的严格验证
4. 石像鬼独狼机制的正确实现
5. 所有预设剧本的完整性

---

**最后更新**: 2025-12-19
