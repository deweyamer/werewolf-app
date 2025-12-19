// ============================================
// 共享类型定义（前后端通用）
// ============================================

export type UserRole = 'admin' | 'god' | 'player';
export type GamePhase = 'lobby' | 'fear' | 'dream' | 'wolf' | 'witch' | 'seer' | 'settle' | 'sheriffElection' | 'vote' | 'hunter' | 'daySettle' | 'finished';
export type Camp = 'wolf' | 'good';
export type GameStatus = 'waiting' | 'running' | 'paused' | 'finished';

// ============================================
// 用户相关
// ============================================
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
}

export interface UserLoginData {
  username: string;
  password: string;
}

export interface UserSession {
  userId: string;
  username: string;
  role: UserRole;
  token: string;
}

// ============================================
// 剧本相关
// ============================================
export interface RoleAbility {
  id: string;
  name: string;
  description: string;
  canSkip?: boolean; // 是否可以跳过不使用
  targetRequired?: boolean; // 是否需要选择目标
}

export interface RoleConfig {
  id: string;
  name: string;
  camp: Camp;
  count: number;
  abilities: RoleAbility[];
  description: string;
}

export interface PhaseConfig {
  id: GamePhase;
  name: string;
  description: string;
  order: number;
  isNightPhase: boolean;
  actorRole?: string; // 该阶段由哪个角色操作
}

export interface Script {
  id: string;
  name: string;
  description: string;
  playerCount: number;
  roles: RoleConfig[];
  phases: PhaseConfig[];
  rules: string; // 规则说明（Markdown）
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 游戏相关
// ============================================
export interface GamePlayer {
  userId: string;
  username: string;
  playerId: number; // 1-12 号位
  role: string;
  camp: Camp;
  alive: boolean;
  isSheriff: boolean;
  outReason?: string;
  feared?: boolean; // 是否被恐惧
  // 角色技能状态
  abilities: {
    antidote?: boolean; // 女巫解药
    poison?: boolean; // 女巫毒药
  };
}

export interface ActionLog {
  id: string;
  timestamp: string;
  round: number;
  phase: GamePhase;
  actorId: string; // 执行者 userId
  actorPlayerId: number; // 执行者号位
  action: string; // 操作类型
  target?: number; // 目标号位
  result: string; // 操作结果描述
  visible: 'all' | 'god' | 'self'; // 可见性
}

export interface Game {
  id: string;
  roomCode: string; // 6位房间码
  scriptId: string;
  scriptName: string;
  hostId: string; // 上帝用户ID
  hostUsername: string;
  players: GamePlayer[];
  status: GameStatus;
  currentPhase: GamePhase;
  currentRound: number;
  history: ActionLog[];
  sheriffId: number; // 警长号位（0表示无警长）
  sheriffElectionDone: boolean;
  // 夜间操作缓存（增强版：包含提交状态和结果）
  nightActions: {
    // 恐惧阶段
    fear?: number;
    fearSubmitted?: boolean;

    // 守护阶段
    dream?: number;
    dreamSubmitted?: boolean;

    // 狼人阶段
    wolfKill?: number;
    wolfSubmitted?: boolean;

    // 女巫阶段
    witchAction?: 'none' | 'save' | 'poison';
    witchTarget?: number;
    witchSubmitted?: boolean;
    witchKnowsVictim?: number; // 女巫看到被刀的人

    // 预言家阶段
    seerCheck?: number;
    seerResult?: 'wolf' | 'good';
    seerSubmitted?: boolean;
  };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  winner?: 'wolf' | 'good';
}

// ============================================
// WebSocket 消息协议
// ============================================

// 客户端 → 服务器
export type ClientMessage =
  // 认证相关
  | { type: 'AUTH', token: string }
  // 房间管理
  | { type: 'CREATE_ROOM', scriptId: string }
  | { type: 'JOIN_ROOM', roomCode: string }
  | { type: 'LEAVE_ROOM' }
  // 上帝操作
  | { type: 'GOD_ASSIGN_ROLES', assignments: { playerId: number, roleId: string }[] }
  | { type: 'GOD_START_GAME' }
  | { type: 'GOD_ADVANCE_PHASE' }
  | { type: 'GOD_FORCE_ACTION', playerId: number, action: any }
  // 玩家操作
  | { type: 'PLAYER_SUBMIT_ACTION', action: PlayerAction }
  // 警长相关
  | { type: 'SHERIFF_CANDIDATES', candidates: number[] }
  | { type: 'SHERIFF_ELECT', sheriffId: number }
  | { type: 'SHERIFF_PASS', targetId: number }
  | { type: 'SHERIFF_TEAR' };

export interface PlayerAction {
  phase: GamePhase;
  playerId: number;
  actionType: string;
  target?: number;
  extraData?: any;
}

// 服务器 → 客户端
export type ServerMessage =
  // 连接状态
  | { type: 'CONNECTED', sessionId: string }
  | { type: 'AUTH_SUCCESS', user: UserSession }
  | { type: 'AUTH_FAILED', message: string }
  // 房间状态
  | { type: 'ROOM_CREATED', roomCode: string, gameId: string }
  | { type: 'ROOM_JOINED', game: Game }
  | { type: 'ROOM_LEFT' }
  | { type: 'PLAYER_JOINED', player: GamePlayer }
  | { type: 'PLAYER_LEFT', playerId: number }
  // 游戏状态更新
  | { type: 'GAME_STATE_UPDATE', game: Game }
  | { type: 'PHASE_CHANGED', phase: GamePhase, prompt: string }
  | { type: 'PLAYER_ACTION_SUBMITTED', playerId: number, actionType: string }
  | { type: 'ROUND_STARTED', round: number }
  | { type: 'GAME_FINISHED', winner: 'wolf' | 'good' }
  // 角色分配（仅发给对应玩家）
  | { type: 'ROLE_ASSIGNED', playerId: number, role: string, camp: Camp }
  // 操作结果反馈
  | { type: 'ACTION_RESULT', success: boolean, message: string }
  // 错误消息
  | { type: 'ERROR', message: string, code?: string };

// ============================================
// API 响应格式
// ============================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  user: UserSession;
  token: string;
}

export interface ScriptListResponse {
  scripts: Script[];
}

export interface GameListResponse {
  games: Game[];
}
