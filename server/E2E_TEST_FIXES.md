# E2E测试修复记录

## 修复概览

成功修复所有端到端测试，最终测试结果：**113/113 测试通过 (100%)**

## 修复的关键问题

### 1. WolfHandler投票逻辑错误

**问题**: 原实现要求所有狼人都投票才能生效（AND逻辑）
**用户反馈**: "狼人是or逻辑 有一个人投票即可"
**修复**:
- 文件: [server/src/game/roles/WolfHandler.ts](server/src/game/roles/WolfHandler.ts)
- 改为OR逻辑：任意一个狼投票即可立即生效
- 移除了等待所有狼人投票的逻辑
- 使用最新投票的目标作为最终目标

```typescript
// 修复前：
const allVoted = aliveWolves.every(wolf =>
  game.nightActions.wolfVotes![wolf.playerId] !== undefined
);
if (!allVoted) {
  return { success: true, message: '投票成功，等待其他狼人' };
}

// 修复后：
// OR逻辑：有任意一个狼投票即可决定目标
const finalTarget = target;
```

### 2. 守墓人验尸返回数据结构错误

**问题**: 返回的data是嵌套结构 `data.gravekeeperResult.camp`，但测试期望 `data.camp`
**修复**:
- 文件: [server/src/game/roles/GravekeeperHandler.ts](server/src/game/roles/GravekeeperHandler.ts)
- 移除了嵌套的 `gravekeeperResult` 对象
- 直接返回 `{ playerId, role, camp, message }`

```typescript
// 修复前：
return {
  success: true,
  message: '验尸成功',
  effect,
  data: {
    gravekeeperResult: {
      playerId: target,
      role: targetPlayer.role,
      camp: targetPlayer.camp,
      message: `${target}号的身份是${targetPlayer.role}`,
    },
  },
};

// 修复后：
return {
  success: true,
  message: '验尸成功',
  effect,
  data: {
    playerId: target,
    role: targetPlayer.role,
    camp: targetPlayer.camp,
    message: `${target}号的身份是${targetPlayer.role}`,
  },
};
```

### 3. 守墓人验尸时机错误

**问题**: 测试在狼刀后立即验尸，但死亡还未结算，玩家仍然存活
**修复**:
- 文件: [server/src/game/script/ScriptE2E.test.ts](server/src/game/script/ScriptE2E.test.ts:358-382)
- 在验尸前先推进到结算阶段让死亡生效
- 完成一整晚流程（settle → 白天 → 第二晚）后再验尸

```typescript
// 修复前：
await submitAction(game.id, 2, 9); // 狼刀9号
await gameService.advancePhase(game.id);
await advanceToPhase(game.id, 'gravekeeper');
const gravekeeperResult = await submitAction(game.id, 5, 9); // 9号还活着！

// 修复后：
await submitAction(game.id, 2, 9); // 狼刀9号
await advanceToPhase(game.id, 'settle');
await gameService.advancePhase(game.id); // 结算让9号死亡
// 完成白天流程
await advanceToPhase(game.id, 'gravekeeper'); // 第二晚
const gravekeeperResult = await submitAction(game.id, 5, 9); // 现在9号已死
```

### 4. 胜利条件测试阶段推进错误

**问题**:
1. 手动设置玩家死亡后，尝试用 `advanceToPhase` 推进到 `settle` 阶段
2. 但 `advanceToPhase` 会循环推进所有中间阶段
3. 中间阶段需要玩家行动，导致无限循环（超时）

**修复**:
- 文件: [server/src/game/script/ScriptE2E.test.ts](server/src/game/script/ScriptE2E.test.ts:507-624)
- 理解GameFlowEngine的胜利检查时机：只在 `nextPhaseConfig.id === 'settle'` 时触发
- 直接设置 `currentPhase` 到settle前的最后一个阶段（`seer`）
- 调用一次 `advancePhase` 即可推进到settle并触发胜利检查

```typescript
// 修复前：
updatedGame.currentPhase = 'settle'; // 错误：已经在settle，不会检查胜利
await gameService.advancePhase(game.id);
// 结果：推进到下一阶段(discussion)，未检查胜利

// 修复后：
updatedGame.currentPhase = 'seer'; // 设置到settle前的阶段
await gameService.advancePhase(game.id); // 推进到settle，触发胜利检查
// 结果：成功检查胜利条件，游戏结束
```

### 5. 女巫技能调用参数错误

**问题**: 测试调用女巫跳过/救人时未传递正确的 `actionType` 参数
**修复**:
- 文件: [server/src/game/script/ScriptE2E.test.ts](server/src/game/script/ScriptE2E.test.ts)
- 跳过: `submitAction(game.id, 7, undefined, { actionType: 'none' })`
- 救人: `submitAction(game.id, 7, undefined, { actionType: 'save' })`
- 毒人: `submitAction(game.id, 7, target, { actionType: 'poison' })`

```typescript
// 修复前：
await submitAction(game.id, 7); // 缺少actionType
await submitAction(game.id, 7, undefined, { useSave: true }); // 错误参数名

// 修复后：
await submitAction(game.id, 7, undefined, { actionType: 'none' });
await submitAction(game.id, 7, undefined, { actionType: 'save' });
```

## 测试结果统计

| 测试文件 | 测试数 | 状态 | 耗时 |
|---------|-------|------|------|
| ScriptPhaseGenerator.test.ts | 16 | ✅ 全部通过 | 14ms |
| RoleRegistry.test.ts | 3 | ✅ 全部通过 | 5ms |
| ScriptValidator.test.ts | 17 | ✅ 全部通过 | 13ms |
| ScriptPresets.test.ts | 38 | ✅ 全部通过 | 12ms |
| ScriptIntegration.test.ts | 25 | ✅ 全部通过 | 2957ms |
| **ScriptE2E.test.ts** | **14** | **✅ 全部通过** | **2032ms** |
| **总计** | **113** | **✅ 100%通过** | **~5s** |

## E2E测试覆盖的场景

### 摄梦人剧本测试
1. ✅ 完成第一晚所有夜间行动
2. ✅ 摄梦人连续两晚梦死机制

### 守墓人石像鬼剧本测试
3. ✅ 石像鬼查验具体角色（独狼机制）
4. ✅ 守墓人验尸获得死者身份信息
5. ✅ 4狼8好阵营平衡验证（石像鬼算狼人）

### 骑士狼美人剧本测试
6. ✅ 狼美人魅惑连结机制
7. ✅ 守卫不能连续守护同一人规则

### 胜利条件验证
8. ✅ 所有狼人死亡 → 好人获胜
9. ✅ 所有好人死亡 → 狼人获胜
10. ✅ 狼人数量≥好人数量 → 狼人获胜

### Corner Cases（边界情况）
11. ✅ 女巫不能自救后再次使用解药
12. ✅ 猎人死亡触发开枪
13. ✅ 预言家被恐惧后无法查验
14. ✅ 死亡玩家不能进行任何操作

## 关键技术点

### GameFlowEngine阶段推进机制
- `advancePhase` 接收当前阶段，返回下一阶段
- 胜利检查在 `nextPhaseConfig.id === 'settle'` 或 `'daySettle'` 时触发
- 必须从前一个阶段推进到settle，不能直接设置为settle

### SkillResolver死亡结算机制
- 技能效果在夜间/白天阶段累积
- 死亡在 `settle` / `daySettle` 阶段统一结算
- 在结算前手动修改玩家状态不会立即生效

### 测试最佳实践
1. **完整流程测试**: 不要跳过中间阶段，模拟真实游戏流程
2. **阶段顺序**: 理解阶段推进逻辑，避免时机错误
3. **数据结构验证**: 确认返回值结构符合预期
4. **参数完整性**: 传递所有必需参数（如actionType）
5. **状态一致性**: 确保游戏状态与测试假设一致

## 后续工作

✅ 所有测试通过，游戏核心逻辑正确
⏳ 待完成：优化前端UI集成

---

**最后更新**: 2025-12-19
**测试框架**: Vitest 4.0.16
**测试通过率**: 100% (113/113)
