import { GamePhase } from '../../../../shared/src/types.js';

/**
 * 剧本难度
 */
export type ScriptDifficulty = 'easy' | 'medium' | 'hard';

/**
 * 胜利条件类型
 */
export type WinConditionType = 'standard' | 'slaughter';

/**
 * 首夜规则配置
 */
export interface FirstNightRules {
  witchCanSaveSelf?: boolean;       // 女巫首夜是否可以自救
  skipSheriffElection?: boolean;    // 是否跳过警长竞选
}

/**
 * 技能交互规则变体
 */
export interface SkillInteractionVariants {
  witchCanSavePoisonSame?: boolean; // 女巫是否可以同夜救毒同一人
  guardCanProtectSame?: boolean;    // 守卫是否可以连续守护同一人
  dreamerKillNights?: number;       // 摄梦人连续几晚梦死（默认2晚）
}

/**
 * 胜利条件配置
 */
export interface WinConditionsConfig {
  type: WinConditionType;           // 标准局 | 屠城局
  customCondition?: string;         // 自定义胜利条件描述
}

/**
 * 规则变体配置
 */
export interface RuleVariants {
  firstNight?: FirstNightRules;
  skillInteractions?: SkillInteractionVariants;
  winConditions?: WinConditionsConfig;
  specialRules?: string[];          // 其他特殊规则（描述性）
}

/**
 * 剧本V2数据结构
 * 核心设计：剧本只负责角色组合，phases由系统动态生成
 */
export interface ScriptV2 {
  id: string;
  name: string;
  description: string;
  playerCount: number;              // 支持6-18人

  // 核心：角色组合（roleId -> 数量）
  roleComposition: {
    [roleId: string]: number;
  };

  // 可选：规则变体配置
  ruleVariants?: RuleVariants;

  // 元数据
  difficulty: ScriptDifficulty;
  tags: string[];                   // 标签：['新手友好', '高阶局', '神职强势']
  rules: string;                    // Markdown规则说明

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

/**
 * 阶段配置
 */
export interface PhaseConfig {
  id: GamePhase;
  name: string;
  description: string;
  order: number;
  isNightPhase: boolean;
  actorRole?: string;               // 该阶段由哪个角色操作
}

/**
 * 夜间角色阶段映射
 */
export interface NightRolePhase {
  roleId: string;
  phaseId: string;
  name: string;
  priority: number;                 // 对应SkillPriority
}

/**
 * 剧本验证结果
 */
export interface ScriptValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 完整剧本配置（包含动态生成的phases）
 */
export interface ScriptWithPhases {
  script: ScriptV2;
  phases: PhaseConfig[];
}

/**
 * 人数预设配置
 */
export interface PlayerCountPreset {
  playerCount: number;
  label: string;
  wolves: number;
  gods: number;
  villagers: number;
  description: string;
  recommendedRoles: {
    roleId: string;
    count: number;
    required: boolean;
  }[];
}
