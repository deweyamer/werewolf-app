# 上帝视角数据统计面板设计方案

## 批判性分析：后端提供 vs 前端计算

### 方案对比

| 维度 | 后端提供数据 | 前端计算数据 | 推荐方案 |
|------|------------|------------|---------|
| **实时性** | ⚠️ 需要轮询或推送 | ✅ 实时响应 | 前端计算 |
| **准确性** | ✅ 100%准确 | ⚠️ 依赖Game对象完整性 | 后端提供 |
| **性能** | ⚠️ 增加服务器负载 | ✅ 客户端计算 | 前端计算 |
| **维护性** | ⚠️ 两端都要改 | ✅ 只改前端 | 前端计算 |
| **复杂度** | ⚠️ 需要新增API | ✅ 利用现有数据 | 前端计算 |
| **可扩展性** | ⚠️ 每个统计都要加接口 | ✅ 前端自由扩展 | 前端计算 |

### 结论：**混合方案最优**

**核心原则**：
1. **基础数据由后端提供**：Game对象包含完整的游戏状态
2. **统计计算由前端完成**：基于Game对象实时计算各种统计指标
3. **复杂查询可选择后端**：如历史游戏分析、跨游戏统计等

### 当前后端已提供的数据（充分性分析）

查看当前Game对象结构：

```typescript
interface Game {
  // ✅ 基础信息
  id: string;
  roomCode: string;
  hostUserId: string;
  scriptId: string;
  scriptName: string;
  status: GameStatus;

  // ✅ 玩家信息（包含死亡原因）
  players: GamePlayer[];  // 每个玩家有 alive, outReason, role, camp 等

  // ✅ 游戏进程
  currentPhase: string;
  currentRound: number;
  currentPhaseType: 'night' | 'day' | 'transition';

  // ✅ 历史记录（最关键！）
  history: GameHistoryLog[];  // 包含所有操作记录

  // ✅ 夜间操作状态
  nightActions: {
    fear?: number;
    fearSubmitted?: boolean;
    dream?: number;
    dreamSubmitted?: boolean;
    wolfVotes?: { [playerId: number]: number };
    wolfKill?: number;
    wolfSubmitted?: boolean;
    witchKnowsVictim?: number | null;
    witchAction?: 'save' | 'poison' | 'none';
    witchTarget?: number;
    witchSubmitted?: boolean;
    seerCheck?: number;
    seerResult?: 'wolf' | 'good';
    seerSubmitted?: boolean;
    // ... 其他角色操作
  };

  // ✅ 投票系统
  sheriffElection?: SheriffElection;
  exileVote?: ExileVote;

  // ✅ 胜利信息
  winner?: 'wolf' | 'good';
  finishedAt?: string;
}

interface GameHistoryLog {
  id: string;
  gameId: string;
  round: number;
  phase: string;
  actorPlayerId: number;
  action: string;
  target?: number;
  result: string;
  timestamp: string;
}
```

### 数据充分性评估：✅ **后端数据已经非常充分！**

后端已经提供了：
1. ✅ 完整的玩家状态（存活、角色、阵营、死因）
2. ✅ 详细的历史记录（每个操作、结果、时间戳）
3. ✅ 实时的夜间操作状态
4. ✅ 投票记录
5. ✅ 游戏进程信息

**唯一可能缺失的数据**：
- ⚠️ 玩家技能使用次数（如女巫药水、守卫守护历史）- 但可以从history推导
- ⚠️ 角色效果生效情况（被守护、被恐惧）- 但可以从history推导

## 数据统计面板设计

### 面板1：游戏概览 (Game Overview)

**数据来源**：直接从Game对象获取

```typescript
interface GameOverviewStats {
  // 基础信息
  gameId: string;
  roomCode: string;
  scriptName: string;
  currentRound: number;
  currentPhase: string;
  status: GameStatus;
  startedAt?: string;
  finishedAt?: string;
  duration?: string; // 计算得出

  // 阵营统计
  totalPlayers: number; // 12
  aliveWolves: number; // 实时计算
  aliveGoods: number;  // 实时计算
  deadWolves: number;
  deadGoods: number;

  // 胜利条件
  winner?: 'wolf' | 'good';
  winCondition?: string; // "所有狼人死亡" | "狼人数>=好人数"
}

// 前端计算函数
function calculateGameOverview(game: Game): GameOverviewStats {
  const alivePlayers = game.players.filter(p => p.alive);
  const aliveWolves = alivePlayers.filter(p => p.camp === 'wolf').length;
  const aliveGoods = alivePlayers.filter(p => p.camp === 'good').length;

  const deadPlayers = game.players.filter(p => !p.alive);
  const deadWolves = deadPlayers.filter(p => p.camp === 'wolf').length;
  const deadGoods = deadPlayers.filter(p => p.camp === 'good').length;

  let duration = undefined;
  if (game.startedAt && game.finishedAt) {
    const start = new Date(game.startedAt).getTime();
    const end = new Date(game.finishedAt).getTime();
    const minutes = Math.floor((end - start) / 60000);
    duration = `${minutes}分钟`;
  }

  return {
    gameId: game.id,
    roomCode: game.roomCode,
    scriptName: game.scriptName,
    currentRound: game.currentRound,
    currentPhase: game.currentPhase,
    status: game.status,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    duration,
    totalPlayers: game.players.length,
    aliveWolves,
    aliveGoods,
    deadWolves,
    deadGoods,
    winner: game.winner,
  };
}
```

### 面板2：玩家状态面板 (Player Status Panel)

**数据来源**：Game.players + Game.history

```typescript
interface PlayerStats {
  playerId: number;
  username: string;
  role: string;
  roleName: string; // 从RoleRegistry获取
  camp: Camp;
  alive: boolean;

  // 死亡信息
  outReason?: string;
  outReasonText?: string; // 翻译后的文本
  deathRound?: number; // 第几晚死亡
  deathPhase?: string; // 在哪个阶段死亡

  // 特殊状态
  isSheriff: boolean;

  // 技能使用情况（从history推导）
  skillUsages: SkillUsage[];
}

interface SkillUsage {
  round: number;
  phase: string;
  action: string;
  target?: number;
  result: string;
  timestamp: string;
}

// 前端计算函数
function calculatePlayerStats(game: Game): PlayerStats[] {
  return game.players.map(player => {
    // 查找死亡信息
    const deathLog = game.history.find(log =>
      log.result.includes(`${player.playerId}号`) &&
      log.result.includes('死亡')
    );

    // 查找该玩家的所有技能使用记录
    const skillUsages = game.history
      .filter(log => log.actorPlayerId === player.playerId)
      .map(log => ({
        round: log.round,
        phase: log.phase,
        action: log.action,
        target: log.target,
        result: log.result,
        timestamp: log.timestamp,
      }));

    // 翻译死因
    const outReasonText = translateDeathReason(player.outReason);

    return {
      playerId: player.playerId,
      username: player.username,
      role: player.role!,
      roleName: getRoleName(player.role!),
      camp: player.camp!,
      alive: player.alive,
      outReason: player.outReason,
      outReasonText,
      deathRound: deathLog?.round,
      deathPhase: deathLog?.phase,
      isSheriff: player.isSheriff,
      skillUsages,
    };
  });
}

function translateDeathReason(reason?: string): string {
  const translations: { [key: string]: string } = {
    'wolfKill': '🐺 被狼刀',
    'poison': '☠️ 被毒死',
    'vote': '🗳️ 被投票放逐',
    'dreamerKilled': '💤 摄梦人梦死',
    'hunter': '🏹 被猎人带走',
    'knight': '⚔️ 被骑士决斗',
  };
  return translations[reason || ''] || reason || '未知';
}
```

### 面板3：夜晚结算面板 (Night Resolution Panel)

**数据来源**：Game.history按round分组

```typescript
interface NightResolution {
  round: number;

  // 各角色操作
  fearTarget?: { actorId: number; targetId: number; result: string };
  dreamTarget?: { actorId: number; targetId: number; result: string };
  gargoyleCheck?: { actorId: number; targetId: number; result: string };
  guardTarget?: { actorId: number; targetId: number };
  wolfKill?: { targetId: number; voters: number[] };
  wolfBeautyCharm?: { actorId: number; targetId: number };
  witchAction?: { actorId: number; action: 'save' | 'poison' | 'none'; target?: number };
  seerCheck?: { actorId: number; targetId: number; result: 'wolf' | 'good' };
  gravekeeperCheck?: { actorId: number; targetId: number; result: string };

  // 结算结果
  deaths: DeathInfo[];
  protections: number[]; // 被守护的玩家

  // 时间戳
  startTime?: string;
  endTime?: string;
}

interface DeathInfo {
  playerId: number;
  reason: string;
  reasonText: string;
  killedBy?: number; // 被谁杀死（如果适用）
}

// 前端计算函数
function calculateNightResolutions(game: Game): NightResolution[] {
  const resolutions: { [round: number]: NightResolution } = {};

  // 按回合分组历史记录
  game.history.forEach(log => {
    if (!resolutions[log.round]) {
      resolutions[log.round] = {
        round: log.round,
        deaths: [],
        protections: [],
      };
    }

    const resolution = resolutions[log.round];

    // 根据阶段和操作类型提取信息
    switch (log.phase) {
      case 'fear':
        resolution.fearTarget = {
          actorId: log.actorPlayerId,
          targetId: log.target!,
          result: log.result,
        };
        break;

      case 'dream':
        resolution.dreamTarget = {
          actorId: log.actorPlayerId,
          targetId: log.target!,
          result: log.result,
        };
        break;

      case 'gargoyle':
        resolution.gargoyleCheck = {
          actorId: log.actorPlayerId,
          targetId: log.target!,
          result: log.result,
        };
        break;

      case 'wolf':
        if (log.action === 'wolfKill') {
          resolution.wolfKill = {
            targetId: log.target!,
            voters: extractWolfVoters(log.result),
          };
        }
        break;

      case 'witch':
        resolution.witchAction = {
          actorId: log.actorPlayerId,
          action: extractWitchAction(log.result),
          target: log.target,
        };
        break;

      case 'seer':
        resolution.seerCheck = {
          actorId: log.actorPlayerId,
          targetId: log.target!,
          result: extractSeerResult(log.result),
        };
        break;

      case 'settle':
        // 从结算日志中提取死亡信息
        if (log.result.includes('死亡')) {
          const death = extractDeathInfo(log.result);
          if (death) {
            resolution.deaths.push(death);
          }
        }
        // 提取守护信息
        if (log.result.includes('守护')) {
          const protectedId = extractProtectedPlayer(log.result);
          if (protectedId) {
            resolution.protections.push(protectedId);
          }
        }
        break;
    }
  });

  return Object.values(resolutions).sort((a, b) => a.round - b.round);
}
```

### 面板4：白天结算面板 (Day Resolution Panel)

**数据来源**：Game.sheriffElection + Game.exileVote + Game.history

```typescript
interface DayResolution {
  round: number;

  // 警长竞选（第一天）
  sheriffElection?: {
    candidates: number[];
    votes: { [voterId: number]: number };
    result: number | 'none';
  };

  // 讨论发言（记录在history中）
  discussions: DiscussionLog[];

  // 放逐投票
  exileVote?: {
    votes: { [voterId: number]: number };
    result: number | 'none';
    isPK: boolean;
    pkPlayers?: number[];
  };

  // 白天死亡
  deaths: DeathInfo[];

  // 猎人开枪
  hunterShot?: {
    hunterId: number;
    targetId: number;
  };
}

// 前端计算函数
function calculateDayResolutions(game: Game): DayResolution[] {
  // 类似夜晚结算，从history中提取白天的操作
  // ...
}
```

### 面板5：技能使用统计 (Skill Usage Stats)

**数据来源**：Game.history按角色聚合

```typescript
interface RoleSkillStats {
  roleId: string;
  roleName: string;
  playerId: number;
  username: string;

  // 通用统计
  totalUsages: number;

  // 角色特定统计
  details: any; // 根据角色不同而不同
}

// 女巫统计
interface WitchStats extends RoleSkillStats {
  details: {
    antidoteUsed: boolean;
    antidoteRound?: number;
    antidoteTarget?: number;

    poisonUsed: boolean;
    poisonRound?: number;
    poisonTarget?: number;

    skippedNights: number[];
  };
}

// 预言家统计
interface SeerStats extends RoleSkillStats {
  details: {
    checks: Array<{
      round: number;
      targetId: number;
      result: 'wolf' | 'good';
    }>;
    correctChecks: number; // 查出狼人的次数
    totalChecks: number;
  };
}

// 守卫统计
interface GuardStats extends RoleSkillStats {
  details: {
    protections: Array<{
      round: number;
      targetId: number;
      successful: boolean; // 是否成功守护
    }>;
    successfulProtections: number;
    totalProtections: number;
  };
}

// 前端计算函数
function calculateSkillUsageStats(game: Game): RoleSkillStats[] {
  const stats: RoleSkillStats[] = [];

  // 遍历每个玩家
  game.players.forEach(player => {
    if (!player.role) return;

    const handler = RoleRegistry.getHandler(player.role);
    if (!handler || !handler.hasNightAction) return;

    // 从history中提取该玩家的所有操作
    const usages = game.history.filter(log =>
      log.actorPlayerId === player.playerId
    );

    // 根据角色类型计算不同的统计
    switch (player.role) {
      case 'witch':
        stats.push(calculateWitchStats(player, usages));
        break;
      case 'seer':
        stats.push(calculateSeerStats(player, usages));
        break;
      case 'guard':
        stats.push(calculateGuardStats(player, usages));
        break;
      // ... 其他角色
      default:
        stats.push({
          roleId: player.role,
          roleName: handler.roleName,
          playerId: player.playerId,
          username: player.username,
          totalUsages: usages.length,
          details: {},
        });
    }
  });

  return stats;
}
```

### 面板6：投票分析面板 (Voting Analysis)

**数据来源**：Game.sheriffElection + Game.exileVote

```typescript
interface VotingAnalysis {
  // 警长竞选分析
  sheriffElection?: {
    candidates: PlayerVoteInfo[];
    voters: VoterInfo[];
    result: number | 'none';
  };

  // 放逐投票分析（按轮次）
  exileVotes: Array<{
    round: number;
    candidates: PlayerVoteInfo[];
    voters: VoterInfo[];
    result: number | 'none';
    isPK: boolean;
  }>;
}

interface PlayerVoteInfo {
  playerId: number;
  username: string;
  role: string; // 上帝视角可见
  camp: Camp;
  voteCount: number;
  voters: number[]; // 谁投了TA
}

interface VoterInfo {
  playerId: number;
  username: string;
  votedFor: number | 'skip';
  followsSheriff?: boolean; // 是否跟警长票
}

// 前端计算函数
function calculateVotingAnalysis(game: Game): VotingAnalysis {
  // 从sheriffElection和exileVote中提取数据
  // 分析投票模式、跟票情况等
  // ...
}
```

## UI设计建议

### 布局方案：多标签页 + 侧边栏

```
┌─────────────────────────────────────────────────────────┐
│ 上帝控制台                                 [导出复盘] [退出] │
├─────────────────────────────────────────────────────────┤
│ Tab: [概览] [玩家] [夜晚] [白天] [技能] [投票]              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   当前标签页内容                                          │
│                                                         │
│   - 卡片式布局                                            │
│   - 表格 + 图表                                          │
│   - 实时更新                                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 关键UI组件

1. **概览仪表盘**：大数字卡片 + 进度条
2. **玩家状态表格**：可排序、可筛选（存活/死亡、阵营）
3. **时间线视图**：展示游戏流程
4. **技能使用热力图**：直观显示技能使用频率
5. **投票关系图**：可视化投票关系网络

## 实施建议

### 优先级

**P0 (立即实施)**:
1. ✅ 游戏概览面板（基础统计）
2. ✅ 玩家状态表格（死亡原因、角色）
3. ✅ 当前回合的夜晚/白天操作状态

**P1 (重要)**:
4. 夜晚结算历史（按回合展示）
5. 技能使用统计（女巫、预言家、守卫）
6. 投票分析（警长、放逐）

**P2 (优化)**:
7. 数据可视化（图表、关系图）
8. 历史回放功能
9. 高级统计（技能成功率、投票模式分析）

### 性能优化

1. **缓存计算结果**：使用useMemo缓存统计数据
2. **虚拟滚动**：历史记录多时使用虚拟列表
3. **按需加载**：切换标签页时才计算该页数据

```typescript
// 使用React useMemo优化
function GodConsoleAnalytics() {
  const { currentGame } = useGameStore();

  // 只在game变化时重新计算
  const overview = useMemo(() =>
    calculateGameOverview(currentGame!),
    [currentGame]
  );

  const playerStats = useMemo(() =>
    calculatePlayerStats(currentGame!),
    [currentGame]
  );

  // ...
}
```

## 最终结论

### 推荐方案：**前端计算为主，后端无需改动**

**理由**：
1. ✅ 后端Game对象数据已经充分（history + players + nightActions）
2. ✅ 前端实时计算，无需轮询
3. ✅ 降低服务器负载
4. ✅ 前端可以灵活扩展新的统计维度
5. ✅ 维护成本低（只需改前端）

**唯一需要后端做的**：
- ⚠️ 确保Game.history记录完整性
- ⚠️ 确保所有角色操作都正确记录到history
- ⚠️ nightActions状态实时更新

**如果未来需要后端支持**：
- 历史游戏查询（跨游戏统计）
- 玩家胜率统计
- 复盘数据持久化

---

**结论**：当前后端数据结构非常完善，前端可以直接基于Game对象计算所有统计数据，无需新增后端接口。
