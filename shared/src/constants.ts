// ============================================
// 共享常量
// ============================================

export const ROLES = {
  NIGHTMARE: '噩梦之影',
  WOLF: '普通狼人',
  DREAMER: '摄梦人',
  WITCH: '女巫',
  SEER: '预言家',
  HUNTER: '猎人',
  VILLAGER: '平民',
} as const;

/**
 * 角色完整信息（用于前端角色选择器）
 */
export interface RoleInfo {
  id: string;
  name: string;
  camp: 'wolf' | 'good';
  type: 'wolf' | 'god' | 'civilian';
  description: string;
  abilities: string[];
}

export const ROLE_INFO: { [roleId: string]: RoleInfo } = {
  // 狼人阵营
  wolf: {
    id: 'wolf',
    name: '普通狼人',
    camp: 'wolf',
    type: 'wolf',
    description: '狼人阵营基础角色，夜间可以和同伴一起刀人',
    abilities: ['夜间刀人'],
  },
  nightmare: {
    id: 'nightmare',
    name: '噩梦之影',
    camp: 'wolf',
    type: 'wolf',
    description: '首晚可以恐惧一名玩家，使其无法行动',
    abilities: ['首晚恐惧', '夜间刀人'],
  },
  wolf_beauty: {
    id: 'wolf_beauty',
    name: '狼美人',
    camp: 'wolf',
    type: 'wolf',
    description: '可以魅惑一名玩家，若狼美人死亡则目标连结死亡',
    abilities: ['夜间魅惑', '连结死亡', '夜间刀人'],
  },
  white_wolf: {
    id: 'white_wolf',
    name: '白狼王',
    camp: 'wolf',
    type: 'wolf',
    description: '特殊狼人，死亡时可能触发特殊效果',
    abilities: ['夜间刀人', '死亡特效'],
  },
  black_wolf: {
    id: 'black_wolf',
    name: '黑狼王',
    camp: 'wolf',
    type: 'wolf',
    description: '特殊狼人，有独特的技能效果',
    abilities: ['夜间刀人', '特殊技能'],
  },
  gargoyle: {
    id: 'gargoyle',
    name: '石像鬼',
    camp: 'wolf',
    type: 'wolf',
    description: '独狼角色，每晚可查验一名玩家的具体角色',
    abilities: ['独狼', '角色查验'],
  },

  // 好人阵营 - 神职
  seer: {
    id: 'seer',
    name: '预言家',
    camp: 'good',
    type: 'god',
    description: '每晚可以查验一名玩家的身份（狼人/好人）',
    abilities: ['身份查验'],
  },
  witch: {
    id: 'witch',
    name: '女巫',
    camp: 'good',
    type: 'god',
    description: '拥有一瓶解药和一瓶毒药，可以救人或毒人',
    abilities: ['解药救人', '毒药杀人'],
  },
  hunter: {
    id: 'hunter',
    name: '猎人',
    camp: 'good',
    type: 'god',
    description: '死亡时可以开枪带走一名玩家',
    abilities: ['死亡开枪'],
  },
  guard: {
    id: 'guard',
    name: '守卫',
    camp: 'good',
    type: 'god',
    description: '每晚可以守护一名玩家，保护其不受狼刀',
    abilities: ['夜间守护'],
  },
  dreamer: {
    id: 'dreamer',
    name: '摄梦人',
    camp: 'good',
    type: 'god',
    description: '每晚梦游，连续两晚到同一人会导致目标梦死',
    abilities: ['夜间梦游', '连续梦死'],
  },
  knight: {
    id: 'knight',
    name: '骑士',
    camp: 'good',
    type: 'god',
    description: '白天可以发起决斗，若对方是狼人则狼人死亡，否则自己死亡',
    abilities: ['白天决斗'],
  },
  gravekeeper: {
    id: 'gravekeeper',
    name: '守墓人',
    camp: 'good',
    type: 'god',
    description: '自动获得上一轮被投票出局者的阵营（好人/坏人）',
    abilities: ['自动验尸'],
  },

  // 平民
  villager: {
    id: 'villager',
    name: '平民',
    camp: 'good',
    type: 'civilian',
    description: '好人阵营基础角色，没有特殊技能，依靠推理和投票',
    abilities: [],
  },
};

export const PHASES = {
  LOBBY: 'lobby',
  FEAR: 'fear',
  DREAM: 'dream',
  WOLF: 'wolf',
  WITCH: 'witch',
  SEER: 'seer',
  SETTLE: 'settle',
  SHERIFF_ELECTION: 'sheriffElection',
  VOTE: 'vote',
  HUNTER: 'hunter',
  DAY_SETTLE: 'daySettle',
  FINISHED: 'finished',
} as const;

export const OUT_REASONS = {
  WOLF_KILL: 'wolf_kill',
  POISON: 'poison',
  EXILE: 'exile',
  HUNTER_SHOOT: 'hunter_shoot',
  DREAM_KILL: 'dream_kill',
  BLACK_WOLF_EXPLODE: 'black_wolf_explode',
  KNIGHT_DUEL: 'knight_duel',
  WOLF_BEAUTY_LINK: 'wolf_beauty_link',
  SELF_DESTRUCT: 'self_destruct',
  GUARD_SAVE_CONFLICT: 'guard_save_conflict',
} as const;

export const WS_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  MESSAGE: 'message',
} as const;

export const DEFAULT_SCRIPT_ID = 'dreamer-12p';

export const ROOM_CODE_LENGTH = 6;
export const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24小时
