import { Game, GamePlayer, GamePhase, NightActionsState, Camp } from '../../../shared/src/types';
import { ROLE_INFO } from '../../../shared/src/constants';

// 角色 → 默认夜间阶段映射
export const ROLE_PHASE_MAP: Record<string, GamePhase> = {
  nightmare: 'fear',
  dreamer: 'dream',
  guard: 'guard',
  seer: 'seer',
  gargoyle: 'gargoyle',
  gravekeeper: 'gravekeeper',
  wolf_beauty: 'wolf_beauty',
  witch: 'witch',
  wolf: 'wolf',
  white_wolf: 'wolf',
  black_wolf: 'wolf',
  hunter: 'wolf',
  knight: 'wolf',
  villager: 'wolf',
};

// 控制项类型定义
export interface ControlDef {
  key: string;
  label: string;
  type: 'toggle' | 'number';
  isNightAction?: boolean; // 标记为 nightActions 字段而非 abilities 字段
}

// 每个角色的可调控制项
export const ROLE_ABILITY_CONTROLS: Record<string, ControlDef[]> = {
  witch: [
    { key: 'antidote', label: '解药', type: 'toggle' },
    { key: 'poison', label: '毒药', type: 'toggle' },
    { key: 'witchKnowsVictim', label: '被刀玩家号', type: 'number', isNightAction: true },
  ],
  dreamer: [
    { key: 'lastDreamTarget', label: '上晚梦游目标', type: 'number' },
  ],
  guard: [
    { key: 'lastGuardTarget', label: '上晚守护目标', type: 'number' },
  ],
};

// 每个角色的默认技能状态
const ROLE_DEFAULT_ABILITIES: Record<string, Record<string, any>> = {
  nightmare: { hasNightAction: true },
  dreamer: { hasNightAction: true, lastDreamTarget: 0 },
  guard: { hasNightAction: true, lastGuardTarget: 0 },
  seer: { hasNightAction: true },
  gargoyle: { hasNightAction: true },
  gravekeeper: { hasNightAction: true },
  wolf_beauty: { hasNightAction: true },
  witch: { hasNightAction: true, antidote: true, poison: true },
  wolf: { hasNightAction: true },
  white_wolf: { hasNightAction: true, whiteWolfBoomUsed: false },
  black_wolf: { hasNightAction: true },
  hunter: { hasNightAction: true },
  knight: { hasNightAction: false, knightDuelUsed: false },
  villager: { hasNightAction: false },
};

// Mock 中文用户名
const MOCK_NAMES = [
  '测试玩家', '张三', '李四', '王五', '赵六', '孙七',
  '周八', '吴九', '郑十', '冯十一', '陈十二', '褚十三',
];

// 狼人阵营角色 ID 列表
const WOLF_ROLES = ['wolf', 'nightmare', 'wolf_beauty', 'white_wolf', 'black_wolf', 'gargoyle'];

export interface SandboxOptions {
  phase?: GamePhase;
  deadPlayers?: Set<number>;
  abilities?: Record<string, any>;
  witchKnowsVictim?: number;
}

export function getDefaultAbilities(roleId: string): Record<string, any> {
  return { ...(ROLE_DEFAULT_ABILITIES[roleId] || { hasNightAction: true }) };
}

export function createSandboxState(roleId: string, options: SandboxOptions = {}): {
  game: Game;
  myPlayer: GamePlayer;
} {
  const roleInfo = ROLE_INFO[roleId];
  const camp: Camp = roleInfo?.camp || 'good';
  const phase = options.phase || ROLE_PHASE_MAP[roleId] || 'wolf';
  const deadPlayers = options.deadPlayers || new Set<number>();
  const abilities = options.abilities || getDefaultAbilities(roleId);

  // 生成 12 个玩家
  const players: GamePlayer[] = [];
  for (let i = 1; i <= 12; i++) {
    if (i === 1) {
      // 座位 1 是当前测试角色
      players.push({
        userId: `user-${i}`,
        username: MOCK_NAMES[0],
        playerId: i,
        role: roleId,
        camp,
        alive: !deadPlayers.has(i),
        isSheriff: false,
        abilities,
      });
    } else {
      // 分配其他角色
      let otherRole = 'villager';
      let otherCamp: Camp = 'good';

      // 如果当前角色是狼人阵营，给 2-3 号分配狼人队友
      if (camp === 'wolf' && (i === 2 || i === 3)) {
        otherRole = 'wolf';
        otherCamp = 'wolf';
      } else if (camp !== 'wolf' && i === 11) {
        // 给好人阵营的测试留几个狼人
        otherRole = 'wolf';
        otherCamp = 'wolf';
      } else if (camp !== 'wolf' && i === 12) {
        otherRole = 'wolf';
        otherCamp = 'wolf';
      }

      players.push({
        userId: `user-${i}`,
        username: MOCK_NAMES[i - 1] || `玩家${i}`,
        playerId: i,
        role: otherRole,
        camp: otherCamp,
        alive: !deadPlayers.has(i),
        isSheriff: false,
        abilities: { hasNightAction: otherCamp === 'wolf' },
      });
    }
  }

  const nightActions: NightActionsState = {};
  if (options.witchKnowsVictim) {
    nightActions.witchKnowsVictim = options.witchKnowsVictim;
  }

  const game: Game = {
    id: 'dev-sandbox',
    roomCode: 'DEV000',
    scriptId: 'dev-script',
    scriptName: '开发测试剧本',
    hostId: 'dev-host',
    hostUsername: '上帝',
    players,
    status: 'running',
    currentRound: 1,
    currentPhase: phase,
    currentPhaseType: 'night',
    history: [],
    sheriffId: 0,
    sheriffElectionDone: false,
    nightActions,
    createdAt: new Date().toISOString(),
  };

  return { game, myPlayer: players[0] };
}
