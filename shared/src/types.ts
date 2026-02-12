// ============================================
// 共享类型定义（前后端通用）
// ============================================

export type UserRole = 'admin' | 'god' | 'player';
export type GamePhase = 'lobby' | 'fear' | 'dream' | 'gargoyle' | 'guard' | 'wolf' | 'wolf_beauty' | 'witch' | 'seer' | 'gravekeeper' | 'settle' | 'sheriffElection' | 'sheriffCampaign' | 'sheriffVote' | 'discussion' | 'vote' | 'voteResult' | 'hunter' | 'knight' | 'daySettle' | 'finished';
export type Camp = 'wolf' | 'good';
export type GameStatus = 'waiting' | 'running' | 'paused' | 'finished';

// 游戏阶段类型
export type GamePhaseType = 'night' | 'day' | 'transition';

// 夜间子阶段
export type NightSubPhase = 'fear' | 'dream' | 'gargoyle' | 'guard' | 'wolf' | 'wolf_beauty' | 'witch' | 'seer' | 'gravekeeper' | 'settle';

// 白天子阶段
export type DaySubPhase = 'sheriffElection' | 'sheriffCampaign' | 'sheriffVote' |
                          'discussion' | 'vote' | 'voteResult' | 'hunter' | 'knight' | 'daySettle';

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
// 剧本V2（新架构）
// ============================================

/**
 * 剧本难度
 */
export type ScriptDifficulty = 'easy' | 'medium' | 'hard';

/**
 * 剧本V2数据结构
 * 核心设计：剧本只负责角色组合，phases由系统动态生成
 */
export interface ScriptV2 {
  id: string;
  name: string;
  description: string;
  playerCount: number; // 固定12人

  // 核心：角色组合（roleId -> 数量）
  roleComposition: {
    [roleId: string]: number;
  };

  // 可选：规则变体配置
  ruleVariants?: {
    firstNight?: {
      witchCanSaveSelf?: boolean;
      skipSheriffElection?: boolean;
    };
    skillInteractions?: {
      witchCanSavePoisonSame?: boolean;
      guardCanProtectSame?: boolean;
      dreamerKillNights?: number;
    };
    winConditions?: {
      type: 'standard' | 'slaughter';
      customCondition?: string;
    };
    specialRules?: string[];
  };

  // 元数据
  difficulty: ScriptDifficulty;
  tags: string[];
  rules: string; // Markdown规则说明

  // 时间戳
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
  isBot?: boolean; // 是否是机器人玩家（用于测试模式）
  // 角色技能状态
  abilities: {
    // 通用
    hasNightAction?: boolean; // 是否有夜间行动

    // 女巫
    antidote?: boolean; // 女巫解药
    poison?: boolean; // 女巫毒药

    // 摄梦人
    lastDreamTarget?: number; // 摄梦人上一晚梦游的目标
    dreamKillReady?: boolean; // 摄梦人是否准备好梦死目标(连续2晚)

    // 守卫
    lastGuardTarget?: number; // 守卫上次守护的目标（向后兼容）
    guardHistory?: number[]; // 守卫守护历史记录（0 表示空手/放弃守护）

    // 骑士
    knightDuelUsed?: boolean; // 骑士决斗是否已使用

    // 白狼王
    whiteWolfBoomUsed?: boolean; // 白狼王自爆是否已使用

    // 可扩展其他角色技能状态
    [key: string]: any;
  };
  // 警长竞选相关
  sheriffCandidate?: boolean; // 是否上警
  sheriffWithdrawn?: boolean; // 是否退水
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

// 警长竞选状态
export interface SheriffElectionState {
  phase: 'signup' | 'campaign' | 'voting' | 'tie' | 'done'; // 上警 | 竞选发言 | 投票 | 平票 | 完成
  candidates: number[]; // 上警的玩家号位
  withdrawn: number[];  // 退水的玩家
  votes: { [voterId: number]: number | 'skip' }; // 投票记录
  voteTally?: { [candidateId: number]: number }; // 加权计票结果（候选人 -> 得票数，含警长1.5票权重）
  result?: number;      // 当选警长
  tiedPlayers?: number[]; // 平票的玩家列表
}

// 警徽状态
export type SheriffBadgeState =
  | 'normal'           // 正常持有
  | 'pending_transfer' // 等待传递（警长死亡）
  | 'pending_assign'   // 等待上帝指定（狼人自爆或平票）
  | 'destroyed';       // 已撕毁

// 警徽传递信息
export interface PendingSheriffTransfer {
  fromPlayerId: number;
  options: number[];
  reason: 'death' | 'wolf_explosion' | 'tie';
}

// 放逐投票状态
export interface ExileVoteState {
  phase: 'voting' | 'pk' | 'done'; // 投票 | 平票PK | 完成
  votes: { [voterId: number]: number | 'skip' }; // 投票或弃票
  result?: number | 'tie' | 'none'; // 结果:被放逐玩家 | 平票 | 无人出局
  pkPlayers?: number[];    // 平票PK玩家
  pkVotes?: { [voterId: number]: number | 'skip' }; // PK投票
}

// 狼人聊天消息
export interface WolfChatMessage {
  playerId: number;
  playerName: string;
  content: string;
  timestamp: string;
}

// 夜间操作状态
export interface NightActionsState {
  // 恐惧阶段
  fear?: number;
  fearSubmitted?: boolean;

  // 守护阶段（摄梦人）
  dream?: number;
  dreamSubmitted?: boolean;

  // 石像鬼阶段
  gargoyleTarget?: number;
  gargoyleSubmitted?: boolean;

  // 守卫阶段
  guardTarget?: number;
  guardSubmitted?: boolean;

  // 狼人阶段
  wolfKill?: number;
  wolfSubmitted?: boolean;
  wolfVotes?: { [wolfId: number]: number }; // 狼人投票记录

  // 狼人聊天记录（刀人阶段临时聊天室）
  wolfChat?: WolfChatMessage[];

  // 狼美人阶段
  wolfBeautyTarget?: number;
  wolfBeautySubmitted?: boolean;

  // 女巫阶段
  witchAction?: 'none' | 'save' | 'poison';
  witchTarget?: number;
  witchSubmitted?: boolean;
  witchKnowsVictim?: number; // 女巫看到被刀的人

  // 预言家阶段
  seerCheck?: number;
  seerResult?: 'wolf' | 'good';
  seerSubmitted?: boolean;

  // 守墓人阶段
  gravekeeperTarget?: number;
  gravekeeperSubmitted?: boolean;
}

// 游戏事件（用于玩家端事件流）
export interface GameEvent {
  id: string;
  timestamp: string;
  round: number;
  type: 'death' | 'phase' | 'vote_result' | 'sheriff' | 'round_start' | 'game_end' | 'sheriff_transfer' | 'boom' | 'night_action' | 'settlement';
  icon: string;
  text: string;
  details?: string;
}

// 警徽移交记录
export interface SheriffTransferRecord {
  fromPlayerId: number;   // 原警长
  toPlayerId: number | 'destroyed';  // 新警长 或 警徽流失
  reason: string;         // 'death' | 'wolf_explosion' | 'tie' 等
}

// 回合历史记录
export interface RoundHistoryEntry {
  round: number;
  nightActions: NightActionsState;
  sheriffElection?: SheriffElectionState;  // 警长选举数据（含投票明细和计票结果）
  exileVote?: ExileVoteState;
  deaths: number[];  // 该回合死亡的玩家
  settlementMessage?: string;  // 结算信息
  sheriffTransfers?: SheriffTransferRecord[];  // 本回合的警徽移交记录
}

// 待处理的死亡触发效果
export interface PendingDeathTrigger {
  id: string;
  type: 'hunter_shoot' | 'black_wolf_explode';
  actorId: number;       // 触发者（猎人/黑狼王）号位
  actorRole: string;     // 触发者角色
  message: string;       // 提示信息
  resolved: boolean;     // 是否已处理
  targetId?: number;     // 上帝指定的目标（0 或 undefined = 未指定）
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

  // 回合和阶段信息
  currentRound: number;
  currentPhase: GamePhase;
  currentPhaseType: GamePhaseType; // 'night' | 'day' | 'transition'

  history: ActionLog[];
  sheriffId: number; // 警长号位（0表示无警长）
  sheriffElectionDone: boolean;

  // 警长竞选系统
  sheriffElection?: SheriffElectionState;

  // 警徽状态管理
  sheriffBadgeState?: SheriffBadgeState;
  pendingSheriffTransfer?: PendingSheriffTransfer;

  // 放逐投票系统
  exileVote?: ExileVoteState;

  // 夜间操作缓存（增强版：包含提交状态和结果）
  nightActions: NightActionsState;

  // 历史回合记录（用于上帝视角查看历史）
  roundHistory?: RoundHistoryEntry[];

  // 待处理的死亡触发效果（猎人开枪、黑狼王爆炸等）
  pendingDeathTriggers?: PendingDeathTrigger[];

  // 第一轮延迟死亡：夜晚结算的死亡信息暂存于此，上警结束后再公布和应用
  pendingNightDeaths?: {
    deaths: number[];               // 死亡玩家号位列表
    messages: string[];             // 结算消息
    settleResult: any;              // 完整结算结果（用于死亡触发处理）
  };

  // 自爆标记：狼人自爆后跳过白天直接进入夜晚
  skipToNight?: boolean;

  // 当前夜间阶段是否为死亡角色的空操作阶段（由上帝手动确认推进，防止信息泄露）
  currentPhaseDeadPlayer?: boolean;

  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  winner?: 'wolf' | 'good';
  hasBot?: boolean; // 是否包含机器人玩家（测试模式）
  autoAdvanceEnabled?: boolean; // 是否启用自动阶段推进（默认 true）
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
  | { type: 'CREATE_ROOM_WITH_CUSTOM_SCRIPT', script: ScriptV2 }
  | { type: 'JOIN_ROOM', roomCode: string, playerId?: number }
  | { type: 'LEAVE_ROOM' }
  // 上帝操作
  | { type: 'GOD_ASSIGN_ROLES', assignments: { playerId: number, roleId: string }[] }
  | { type: 'GOD_START_GAME' }
  | { type: 'GOD_ADVANCE_PHASE' }
  | { type: 'GOD_FORCE_ACTION', playerId: number, action: any }
  | { type: 'GOD_CREATE_TEST_GAME', scriptId: string } // 创建测试游戏（带12个机器人）
  | { type: 'GOD_FORCE_END_GAME', winner?: 'wolf' | 'good' } // 强制结束游戏
  | { type: 'GOD_KICK_PLAYER', playerId: number } // 踢出玩家
  | { type: 'GOD_PAUSE_GAME' } // 暂停游戏
  | { type: 'GOD_RESUME_GAME' } // 恢复游戏
  // 玩家操作
  | { type: 'PLAYER_SUBMIT_ACTION', action: PlayerAction }
  // 警长竞选相关
  | { type: 'SHERIFF_SIGNUP', runForSheriff: boolean } // 上警/不上警
  | { type: 'SHERIFF_WITHDRAW' } // 退水
  | { type: 'SHERIFF_VOTE', candidateId: number | 'skip' } // 投票
  // 上帝控制警长竞选阶段
  | { type: 'GOD_SHERIFF_START_CAMPAIGN' } // 上帝结束上警阶段，进入发言
  | { type: 'GOD_SHERIFF_START_VOTING' } // 上帝结束发言阶段，进入投票
  | { type: 'GOD_SHERIFF_TALLY_VOTES' } // 上帝结束投票阶段，统计结果
  // 警徽传递相关
  | { type: 'SHERIFF_TRANSFER', targetId: number | 'destroy' } // 警长传递警徽或撕毁
  | { type: 'GOD_ASSIGN_SHERIFF', targetId: number | 'none' } // 上帝指定警长（平票或狼人自爆）
  // 放逐投票相关
  | { type: 'EXILE_VOTE', targetId: number | 'skip' } // 放逐投票
  | { type: 'EXILE_PK_VOTE', targetId: number | 'skip' } // 平票PK投票
  // 死亡触发相关
  | { type: 'GOD_RESOLVE_DEATH_TRIGGER', triggerId: string, targetId: number | 'skip' } // 上帝处理猎人开枪/黑狼王爆炸
  // 狼人聊天
  | { type: 'WOLF_CHAT_SEND', content: string }
  // 自动推进开关
  | { type: 'GOD_TOGGLE_AUTO_ADVANCE', enabled: boolean };

export interface PlayerAction {
  phase: GamePhase;
  playerId: number;
  actionType: string;
  target?: number;
  extraData?: any;
  timestamp?: string; // 可选时间戳（用于日志记录）
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
  | { type: 'PHASE_CHANGED', phase: GamePhase, prompt: string, phaseType: GamePhaseType }
  | { type: 'PLAYER_ACTION_SUBMITTED', playerId: number, actionType: string }
  | { type: 'ROUND_STARTED', round: number }
  | { type: 'GAME_FINISHED', winner: 'wolf' | 'good' }
  // 角色分配（仅发给对应玩家）
  | { type: 'ROLE_ASSIGNED', playerId: number, role: string, camp: Camp, hasNightAction: boolean }
  // 操作结果反馈
  | { type: 'ACTION_RESULT', success: boolean, message: string, data?: {
      seerResult?: { target: number; result: 'wolf' | 'good'; message: string };
      victimInfo?: { victimId: number };
      [key: string]: any;
    }}
  // 警长竞选更新
  | { type: 'SHERIFF_ELECTION_UPDATE', state: SheriffElectionState }
  // 警徽状态更新
  | { type: 'SHERIFF_BADGE_UPDATE', sheriffId: number, state: SheriffBadgeState, reason?: string }
  // 警长投票结果（计票完成后广播给所有玩家）
  | { type: 'SHERIFF_VOTE_RESULT', election: SheriffElectionState, winnerId: number | null, isTie: boolean }
  // 放逐投票更新
  | { type: 'EXILE_VOTE_UPDATE', state: ExileVoteState }
  // 狼人聊天消息
  | { type: 'WOLF_CHAT_MESSAGE', message: WolfChatMessage }
  // 自动推进通知
  | { type: 'AUTO_PHASE_ADVANCED', phase: GamePhase, reason: string }
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

// ============================================
// 复盘可视化数据结构
// ============================================

/**
 * 游戏复盘数据 - 用于可视化导出
 */
export interface GameReplayData {
  meta: {
    roomCode: string;
    scriptName: string;
    playerCount: number;
    duration: string;
    winner: 'wolf' | 'good' | null;
    startTime: string;
    endTime: string;
  };

  players: PlayerReplayInfo[];

  rounds: RoundReplayData[];
}

/**
 * 玩家复盘信息
 */
export interface PlayerReplayInfo {
  playerId: number;
  username: string;
  role: string;
  roleName: string;
  camp: 'wolf' | 'good';
  isSheriff: boolean;
  deathRound?: number;
  deathReason?: string;
}

/**
 * 回合复盘数据
 */
export interface RoundReplayData {
  round: number;

  night: {
    actions: NightActionReplayRecord[];
    wolfChat?: WolfChatMessage[];
    settlement: string;
    deaths: DeathReplayInfo[];
  };

  day: {
    sheriffElection?: SheriffElectionReplayRecord;
    exileVote?: ExileVoteReplayRecord;
    deaths: DeathReplayInfo[];
    /** 特殊白天事件（自爆、警徽流转等） */
    specialEvents?: SpecialReplayEvent[];
  };
}

/**
 * 特殊事件（自爆、猎人开枪、骑士决斗、警徽流转等）
 */
export interface SpecialReplayEvent {
  type: 'boom' | 'hunter_shoot' | 'knight_duel' | 'sheriff_transfer' | 'sheriff_destroyed';
  icon: string;
  text: string;
}

/**
 * 夜间行动记录
 */
export interface NightActionReplayRecord {
  role: string;
  roleName: string;
  playerId: number;
  action: string;
  target?: number;
  targetName?: string;
  result?: string;
}

/**
 * 死亡信息
 */
export interface DeathReplayInfo {
  playerId: number;
  playerName: string;
  role: string;
  roleName: string;
  cause: string;
  causeText: string;
}

/**
 * 警长竞选记录
 */
export interface SheriffElectionReplayRecord {
  candidates: { playerId: number; playerName: string }[];
  withdrawn: { playerId: number; playerName: string }[];
  votes: {
    voterId: number;
    voterName: string;
    voteWeight: number;
    targetId: number | 'skip';
    targetName?: string;
  }[];
  tally: {
    playerId: number;
    playerName: string;
    voteCount: number;
  }[];
  result: {
    winnerId: number | null;
    winnerName?: string;
    isTie: boolean;
    tiedPlayers?: number[];
    godAssigned?: boolean;
  };
}

/**
 * 放逐投票记录
 */
export interface ExileVoteReplayRecord {
  votes: {
    voterId: number;
    voterName: string;
    voteWeight: number;
    targetId: number | 'skip';
    targetName?: string;
  }[];
  tally: {
    playerId: number;
    playerName: string;
    voteCount: number;
  }[];
  result: {
    exiledId: number | null;
    exiledName?: string;
    isTie: boolean;
    isPeace: boolean;
  };
}
