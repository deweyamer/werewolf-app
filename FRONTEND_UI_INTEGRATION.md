# 前端UI集成优化方案

## 当前问题分析

### 1. 剧本系统不匹配

**问题**: 前端仍然使用旧的剧本格式（Script），后端已经升级到ScriptV2
- 前端GodConsole.tsx使用 `script.roles`（RoleConfig[]数组）
- 后端使用 `script.roleComposition`（{roleId: count}对象）
- 前端期望每个role有 `name`, `camp`, `count` 属性
- 后端只返回roleId和数量，需要通过RoleRegistry查询详细信息

### 2. 阶段显示不完整

**问题**: 前端硬编码了部分阶段标签，缺少新增的角色阶段
- 现有标签: fear, dream, wolf, witch, seer, settle, vote等
- 缺失标签: gargoyle, gravekeeper, knight, guard, wolf_beauty等新角色阶段

### 3. 角色特定界面不完整

**问题**: 玩家视图只实现了部分角色的专属UI
- ✅ 已实现: 女巫、摄梦人、噩梦之影
- ❌ 缺失: 石像鬼、守墓人、守卫、预言家、猎人、骑士、狼美人等

### 4. 操作状态显示不准确

**问题**: GodConsole显示的夜间操作状态基于旧的nightActions结构
- 缺少新角色的操作状态（gargoyle, gravekeeper等）
- Wolf投票逻辑改为OR后，显示逻辑需要更新

## 优化方案

### 阶段 1: 适配新剧本系统

#### 1.1 更新类型定义
```typescript
// shared/src/types.ts
export interface ScriptWithPhases extends ScriptV2 {
  phases: PhaseConfig[];
}

export interface RoleInfo {
  roleId: string;
  roleName: string;
  camp: Camp;
  count: number;
  description?: string;
}
```

#### 1.2 更新前端API接口
```typescript
// client/src/services/api.ts
export async function fetchScripts(): Promise<ScriptWithPhases[]> {
  const response = await fetch(`${config.apiUrl}/scripts`);
  const data = await response.json();
  return data.data.scripts; // 后端返回带phases的完整剧本
}

export async function fetchRoleInfo(roleId: string): Promise<RoleInfo> {
  // 通过RoleRegistry获取角色详情
  // 或者后端新增一个 GET /api/roles/:roleId 接口
}
```

#### 1.3 更新GodConsole角色分配界面
```typescript
// GodConsole.tsx - 角色分配UI改造
const currentScript = scripts.find(s => s.id === currentGame?.scriptId);

// 构建角色信息（从roleComposition + RoleRegistry）
const roleInfos: RoleInfo[] = Object.entries(currentScript.roleComposition).map(([roleId, count]) => {
  const handler = RoleRegistry.getHandler(roleId);
  return {
    roleId,
    roleName: handler.roleName,
    camp: handler.camp,
    count,
  };
});

// UI显示
<div className="text-gray-300 text-sm space-y-1">
  {roleInfos.map(role => (
    <div key={role.roleId}>
      {role.roleName} x{role.count} ({role.camp === 'wolf' ? '狼人' : '好人'})
    </div>
  ))}
</div>
```

### 阶段 2: 完善阶段显示

#### 2.1 动态阶段标签系统
```typescript
// client/src/utils/phaseLabels.ts
export const PHASE_LABELS: { [key: string]: { icon: string; label: string } } = {
  // 游戏流程
  'lobby': { icon: '⏳', label: '大厅' },
  'settle': { icon: '⚖️', label: '夜间结算' },
  'daySettle': { icon: '☀️', label: '白天结算' },
  'finished': { icon: '🏁', label: '游戏结束' },

  // 投票相关
  'sheriffElection': { icon: '🎖️', label: '警长竞选' },
  'vote': { icon: '🗳️', label: '投票放逐' },
  'discussion': { icon: '💬', label: '讨论发言' },

  // 角色技能阶段
  'fear': { icon: '🌙', label: '恐惧阶段 (噩梦之影)' },
  'dream': { icon: '💤', label: '摄梦阶段 (摄梦人)' },
  'gargoyle': { icon: '🗿', label: '查验阶段 (石像鬼)' },
  'guard': { icon: '🛡️', label: '守护阶段 (守卫)' },
  'wolf': { icon: '🐺', label: '狼人阶段' },
  'wolf_beauty': { icon: '💃', label: '魅惑阶段 (狼美人)' },
  'witch': { icon: '🧪', label: '女巫阶段' },
  'seer': { icon: '🔮', label: '预言家阶段' },
  'gravekeeper': { icon: '⚰️', label: '守墓阶段 (守墓人)' },
  'hunter': { icon: '🏹', label: '猎人开枪' },
  'knight': { icon: '⚔️', label: '骑士阶段' },
};

export function getPhaseLabel(phase: string): string {
  const phaseInfo = PHASE_LABELS[phase];
  if (phaseInfo) {
    return `${phaseInfo.icon} ${phaseInfo.label}`;
  }
  return phase;
}
```

#### 2.2 更新GodConsole使用动态标签
```typescript
import { getPhaseLabel } from '../utils/phaseLabels';

// 替换所有硬编码的getPhaseLabel函数
<span className="text-blue-300 font-medium">
  {getPhaseLabel(log.phase)}
</span>
```

### 阶段 3: 完善角色专属UI

#### 3.1 石像鬼查验界面
```typescript
// PlayerView.tsx - 添加石像鬼UI
{myPlayer.role === 'gargoyle' && currentGame.currentPhase === 'gargoyle' && (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
    <h3 className="text-xl font-bold text-white mb-4">
      🗿 石像鬼查验阶段
    </h3>
    <p className="text-gray-300 mb-4">
      你是狼队大哥（独狼），选择一名玩家查看其具体角色。
    </p>

    <div className="mb-4 p-3 bg-red-600/20 border border-red-500 rounded-lg">
      <p className="text-red-300 text-sm">
        ⚠️ 你是狼阵营但不参与狼刀，不与小狼见面
      </p>
    </div>

    <div className="space-y-4">
      <div>
        <label className="block text-white text-sm font-medium mb-2">
          选择查验目标
        </label>
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(Number(e.target.value))}
          className="w-full px-4 py-2 bg-gray-800 border border-purple-500/50 rounded-lg text-white"
        >
          <option value={0}>请选择目标...</option>
          {currentGame.players
            .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
            .map((player) => (
              <option key={player.playerId} value={player.playerId}>
                {player.playerId}号 - {player.username}
              </option>
            ))}
        </select>
      </div>
      <button
        onClick={handleSubmitAction}
        disabled={selectedTarget === 0}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition"
      >
        查验
      </button>
    </div>
  </div>
)}
```

#### 3.2 守墓人验尸界面
```typescript
{myPlayer.role === 'gravekeeper' && currentGame.currentPhase === 'gravekeeper' && (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
    <h3 className="text-xl font-bold text-white mb-4">
      ⚰️ 守墓人验尸阶段
    </h3>
    <p className="text-gray-300 mb-6">
      选择一名已死亡的玩家，查看其真实身份。
    </p>

    {/* 显示死者列表 */}
    {currentGame.players.filter(p => !p.alive).length > 0 ? (
      <div className="space-y-4">
        <div className="mb-4 p-4 bg-gray-600/20 border border-gray-500 rounded-lg">
          <h4 className="text-white font-bold mb-2">已出局玩家:</h4>
          <div className="flex flex-wrap gap-2">
            {currentGame.players
              .filter(p => !p.alive)
              .map(player => (
                <div key={player.playerId} className="px-3 py-1 bg-red-600/30 border border-red-500 rounded">
                  <span className="text-white">{player.playerId}号</span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <label className="block text-white text-sm font-medium mb-2">
            选择验尸目标
          </label>
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(Number(e.target.value))}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-500/50 rounded-lg text-white"
          >
            <option value={0}>请选择目标...</option>
            {currentGame.players
              .filter((p) => !p.alive)
              .map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerId}号 - {player.username}
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={handleSubmitAction}
          disabled={selectedTarget === 0}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition"
        >
          验尸
        </button>
      </div>
    ) : (
      <div className="text-center text-gray-400 py-8">
        暂无死者可以验尸
      </div>
    )}
  </div>
)}
```

#### 3.3 守卫守护界面
```typescript
{myPlayer.role === 'guard' && currentGame.currentPhase === 'guard' && (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
    <h3 className="text-xl font-bold text-white mb-4">
      🛡️ 守卫守护阶段
    </h3>
    <p className="text-gray-300 mb-6">
      选择一名玩家进行守护，可以阻挡狼刀。
    </p>

    {/* 显示上一晚守护的玩家 */}
    {myPlayer.abilities.lastGuardTarget && (
      <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-500 rounded-lg">
        <p className="text-yellow-300 text-sm">
          ⚠️ 上一晚守护了 {myPlayer.abilities.lastGuardTarget}号
          {/* 如果规则不允许连续守护 */}
          {currentScript?.ruleVariants?.skillInteractions?.guardCanProtectSame === false && (
            <span className="text-red-400 ml-2">(不能再次守护此人)</span>
          )}
        </p>
      </div>
    )}

    <div className="space-y-4">
      <div>
        <label className="block text-white text-sm font-medium mb-2">
          选择守护目标
        </label>
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(Number(e.target.value))}
          className="w-full px-4 py-2 bg-gray-800 border border-blue-500/50 rounded-lg text-white"
        >
          <option value={0}>请选择目标...</option>
          {currentGame.players
            .filter((p) => p.alive &&
              // 如果不能连续守护，过滤掉上一晚的目标
              !(currentScript?.ruleVariants?.skillInteractions?.guardCanProtectSame === false &&
                p.playerId === myPlayer.abilities.lastGuardTarget)
            )
            .map((player) => (
              <option key={player.playerId} value={player.playerId}>
                {player.playerId}号 - {player.username}
              </option>
            ))}
        </select>
      </div>
      <button
        onClick={handleSubmitAction}
        disabled={selectedTarget === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition"
      >
        守护
      </button>
    </div>
  </div>
)}
```

#### 3.4 预言家查验界面（增强版）
```typescript
{myPlayer.role === 'seer' && currentGame.currentPhase === 'seer' && (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
    <h3 className="text-xl font-bold text-white mb-4">
      🔮 预言家查验阶段
    </h3>

    {/* 检查是否被恐惧 */}
    {myPlayer.status?.includes('feared') ? (
      <div className="text-center py-8">
        <div className="text-red-400 text-xl mb-4">😱</div>
        <p className="text-red-400 font-bold text-lg mb-2">你被恐惧了！</p>
        <p className="text-gray-300">本晚无法使用查验技能</p>
      </div>
    ) : (
      <>
        <p className="text-gray-300 mb-6">
          选择一名玩家，查验其阵营（好人/狼人）。
        </p>

        {/* 显示查验历史 */}
        {myPlayer.abilities.checkHistory && myPlayer.abilities.checkHistory.length > 0 && (
          <div className="mb-4 p-4 bg-cyan-600/20 border border-cyan-500 rounded-lg">
            <h4 className="text-white font-bold mb-2">查验记录:</h4>
            <div className="space-y-1 text-sm">
              {myPlayer.abilities.checkHistory.map((record: any, idx: number) => (
                <div key={idx} className="text-gray-300">
                  第{record.round}晚: {record.target}号 →{' '}
                  <span className={record.result === 'wolf' ? 'text-red-400' : 'text-blue-400'}>
                    {record.result === 'wolf' ? '狼人' : '好人'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              选择查验目标
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(Number(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-cyan-500/50 rounded-lg text-white"
            >
              <option value={0}>请选择目标...</option>
              {currentGame.players
                .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
                .map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.playerId}号 - {player.username}
                  </option>
                ))}
            </select>
          </div>
          <button
            onClick={handleSubmitAction}
            disabled={selectedTarget === 0}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition"
          >
            查验
          </button>
        </div>
      </>
    )}
  </div>
)}
```

### 阶段 4: 更新GodConsole操作状态显示

#### 4.1 动态显示所有角色阶段状态
```typescript
// GodConsole.tsx - 动态生成阶段状态卡片
{currentGame.status === 'running' && (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
    <h3 className="text-xl font-bold text-white mb-4">
      当前阶段: {getPhaseLabel(currentGame.currentPhase)} | 回合: {currentGame.currentRound}
    </h3>

    {/* 动态显示当前阶段信息 */}
    <PhaseStatusCard
      game={currentGame}
      phase={currentGame.currentPhase}
      script={currentScript}
    />
  </div>
)}

// 新增组件: PhaseStatusCard
interface PhaseStatusCardProps {
  game: Game;
  phase: string;
  script: ScriptWithPhases;
}

function PhaseStatusCard({ game, phase, script }: PhaseStatusCardProps) {
  const phaseConfig = script.phases.find(p => p.id === phase);

  if (!phaseConfig) {
    return <div className="text-gray-400">未知阶段</div>;
  }

  // 根据阶段类型渲染不同的状态卡片
  switch (phase) {
    case 'fear':
      return <FearPhaseStatus game={game} />;
    case 'dream':
      return <DreamPhaseStatus game={game} />;
    case 'gargoyle':
      return <GargoylePhaseStatus game={game} />;
    case 'guard':
      return <GuardPhaseStatus game={game} />;
    case 'wolf':
      return <WolfPhaseStatus game={game} />;
    case 'wolf_beauty':
      return <WolfBeautyPhaseStatus game={game} />;
    case 'witch':
      return <WitchPhaseStatus game={game} />;
    case 'seer':
      return <SeerPhaseStatus game={game} />;
    case 'gravekeeper':
      return <GravekeeperPhaseStatus game={game} />;
    default:
      return (
        <div className="p-4 bg-white/5 rounded-lg">
          <div className="text-white font-bold mb-2">
            {getPhaseLabel(phase)}
          </div>
          <div className="text-gray-300 text-sm">
            {phaseConfig.description}
          </div>
        </div>
      );
  }
}

// 示例: 石像鬼阶段状态
function GargoylePhaseStatus({ game }: { game: Game }) {
  return (
    <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
      <h4 className="text-white font-bold mb-2">🗿 石像鬼查验阶段</h4>
      <div className="text-gray-300 text-sm">
        {game.nightActions.gargoyleSubmitted ? (
          <div className="text-green-400">
            ✅ 石像鬼已查验: {game.nightActions.gargoyleTarget ? `${game.nightActions.gargoyleTarget}号` : '未知'}
          </div>
        ) : (
          <div className="text-yellow-400">⏳ 等待石像鬼操作...</div>
        )}
      </div>
    </div>
  );
}
```

### 阶段 5: 后端API优化

#### 5.1 新增角色信息查询接口
```typescript
// server/src/services/GameService.ts
public getRoleInfo(roleId: string): RoleInfo | null {
  const handler = RoleRegistry.getHandler(roleId);
  if (!handler) return null;

  return {
    roleId: handler.roleId,
    roleName: handler.roleName,
    camp: handler.camp,
    hasNightAction: handler.hasNightAction,
    hasDayAction: handler.hasDayAction,
    description: handler.description || '',
  };
}

public getAllRoles(): RoleInfo[] {
  return RoleRegistry.getAllRoleIds().map(roleId =>
    this.getRoleInfo(roleId)!
  ).filter(Boolean);
}
```

#### 5.2 更新WebSocket消息类型
```typescript
// shared/src/types.ts - 新增消息类型
export type ServerMessage =
  | { type: 'ROLE_INFO'; roleInfo: RoleInfo }
  | { type: 'ALL_ROLES'; roles: RoleInfo[] }
  | { type: 'SCRIPT_WITH_PHASES'; script: ScriptWithPhases }
  // ... 其他消息类型
```

## 实施优先级

### P0 (必须) - 核心功能
1. ✅ 适配新剧本系统（ScriptV2格式）
2. ✅ 动态阶段标签系统
3. ✅ 石像鬼UI（最重要的新角色）
4. ✅ 守墓人UI

### P1 (重要) - 增强体验
5. 守卫UI
6. 预言家增强UI（显示查验历史）
7. 狼美人UI
8. GodConsole动态阶段状态

### P2 (优化) - 锦上添花
9. 骑士UI
10. 猎人UI
11. 操作历史优化
12. 复盘功能增强

## 测试计划

### 单元测试
- [ ] PhaseLabels工具函数测试
- [ ] RoleInfo转换逻辑测试

### 集成测试
- [ ] 创建房间 → 选择剧本 → 显示正确的角色列表
- [ ] 角色分配 → 玩家收到正确的角色信息
- [ ] 石像鬼查验 → 返回正确的角色名
- [ ] 守墓人验尸 → 返回正确的阵营信息

### E2E测试
- [ ] 完整游戏流程（12人局）
- [ ] 所有角色UI交互测试
- [ ] 胜利条件触发测试

---

**最后更新**: 2025-12-19
**状态**: 规划中
