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
  WOLF_KILL: 'wolfKill',
  POISON: 'poison',
  DREAM_DEATH: 'dreamDeath',
  DREAMER_KILLED: 'dreamerKilled',
  VOTE: 'vote',
  HUNTER_SHOOT: 'hunterShoot',
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
