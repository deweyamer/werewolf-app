import { Game, GamePlayer } from '../../../../shared/src/types.js';

// ============================================
// 技能优先级枚举（数字越小优先级越高）
// ============================================
export enum SkillPriority {
  // === 夜间阶段 ===
  FEAR = 100,              // 恐惧（噩梦之影）- 最先执行
  GARGOYLE_CHECK = 150,    // 石像鬼查验 - 独狼查验具体角色
  GUARD = 200,             // 守卫守护 - 阻挡狼刀
  DREAM = 210,             // 摄梦人守护/梦死
  WOLF_KILL = 300,         // 狼刀 - 核心夜间行动
  GRAVEKEEPER = 350,       // 守墓人验尸
  WITCH_ANTIDOTE = 400,    // 女巫解药
  WITCH_POISON = 410,      // 女巫毒药
  SEER_CHECK = 500,        // 预言家查验
  WOLF_BEAUTY = 510,       // 狼美人魅惑

  // === 白天阶段 ===
  SHERIFF_ELECTION = 1000, // 警长竞选
  EXILE_VOTE = 2000,       // 放逐投票
  WHITE_WOLF_BOOM = 2100,  // 白狼王自爆
  KNIGHT_DUEL = 2500,      // 骑士决斗
  HUNTER_SHOOT = 3000,     // 猎人开枪
  BLACK_WOLF_EXPLOSION = 3100, // 黑狼王爆炸
}

// ============================================
// 技能触发时机
// ============================================
export enum SkillTiming {
  NIGHT_ACTION = 'night_action',      // 夜间主动
  DAY_ACTION = 'day_action',          // 白天主动
  ON_DEATH = 'on_death',              // 死亡触发
  ON_EXILE = 'on_exile',              // 放逐触发
  PASSIVE = 'passive',                // 被动生效
}

// ============================================
// 技能效果类型
// ============================================
export enum SkillEffectType {
  KILL = 'kill',                      // 杀死玩家
  PROTECT = 'protect',                // 保护玩家
  SAVE = 'save',                      // 救活玩家
  BLOCK = 'block',                    // 阻止技能使用
  CHECK = 'check',                    // 查验身份
  LINK = 'link',                      // 建立连结
  IMMUNE = 'immune',                  // 免疫所有效果
  EXPLODE = 'explode',                // 爆炸（黑狼王）
  SELF_DESTRUCT = 'self_destruct',   // 自爆（白狼王）
  DREAM_KILL = 'dream_kill',         // 梦死（摄梦人）
}

// ============================================
// 技能效果对象
// ============================================
export interface SkillEffect {
  id: string;                         // 效果唯一ID
  type: SkillEffectType;              // 效果类型
  priority: SkillPriority;            // 优先级
  actorId: number;                    // 施法者玩家ID
  targetId: number;                   // 目标玩家ID
  timing: SkillTiming;                // 触发时机

  // 效果状态
  executed: boolean;                  // 是否已执行
  blocked: boolean;                   // 是否被阻止
  blockReason?: string;               // 阻止原因

  // 效果数据
  data?: {
    result?: any;                     // 技能执行结果（如查验结果）
    message?: string;                 // 提示消息
    extraInfo?: any;                  // 额外信息
  };

  // 条件检查函数（可选）
  condition?: (game: Game) => boolean;
}

// ============================================
// 玩家状态（buff/debuff系统）
// ============================================
export interface PlayerState {
  playerId: number;

  // 负面状态（debuff）
  feared: boolean;                    // 被恐惧（无法使用技能）
  poisoned: boolean;                  // 被毒
  cannotAct: boolean;                 // 无法行动

  // 正面状态（buff）
  protected: boolean;                 // 被守卫守护
  gargoyleProtected: boolean;         // 被石像鬼守护（免疫所有）
  dreamProtected: boolean;            // 被摄梦人守护

  // 连结关系
  linkedTo?: number;                  // 连结到哪个玩家（狼美人魅惑者）
  linkedBy?: number;                  // 被谁连结（狼美人目标）

  // 角色特定状态
  lastGuardTarget?: number;           // 守卫上次守护的目标（不能连续守同一人）
  lastDreamTarget?: number;           // 摄梦人上次梦游的目标
  dreamKillReady?: boolean;           // 摄梦人是否准备好梦死目标

  // 死亡相关
  deathReason?: DeathReason;          // 死亡原因
  willDie: boolean;                   // 本次结算是否会死亡
}

// ============================================
// 死亡原因
// ============================================
export enum DeathReason {
  WOLF_KILL = 'wolf_kill',           // 被狼刀
  POISON = 'poison',                 // 被毒
  EXILE = 'exile',                   // 被放逐
  HUNTER_SHOOT = 'hunter_shoot',     // 被猎人开枪
  DREAM_KILL = 'dream_kill',         // 被梦死
  BLACK_WOLF_EXPLODE = 'black_wolf_explode', // 黑狼王爆炸
  KNIGHT_DUEL = 'knight_duel',       // 骑士决斗
  WOLF_BEAUTY_LINK = 'wolf_beauty_link', // 狼美人连结死亡
}

// ============================================
// 技能效果执行结果
// ============================================
export interface EffectOutcome {
  success: boolean;                   // 是否成功
  message: string;                    // 消息
  death?: number;                     // 导致的死亡玩家ID
  revive?: number;                    // 救活的玩家ID
  protected?: number;                 // 被保护的玩家ID
  blocked?: number;                   // 被阻止的玩家ID
  checkResult?: 'wolf' | 'good';      // 查验结果
  extraData?: any;                    // 额外数据
}

// ============================================
// 结算结果
// ============================================
export interface SettleResult {
  deaths: number[];                   // 死亡玩家ID列表
  revives: number[];                  // 救活玩家ID列表
  protected: number[];                // 被保护玩家ID列表
  blocked: SkillEffect[];             // 被阻止的技能效果列表
  messages: string[];                 // 结算消息列表
  pendingEffects: SkillEffect[];      // 待处理效果（如猎人开枪需要上帝指定）
}

// ============================================
// 阶段结果
// ============================================
export interface PhaseResult {
  finished: boolean;                  // 游戏是否结束
  winner?: 'wolf' | 'good';           // 获胜方
  phase?: string;                     // 当前阶段ID
  prompt?: string;                    // 阶段提示语
  message?: string;                   // 结果消息
}

// ============================================
// 行动结果
// ============================================
export interface ActionResult {
  success: boolean;                   // 是否成功
  message: string;                    // 消息
  data?: any;                         // 返回数据
}
