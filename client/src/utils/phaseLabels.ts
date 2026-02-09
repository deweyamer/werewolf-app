/**
 * 阶段标签工具函数
 * 提供动态的阶段图标和名称
 */

export interface PhaseInfo {
  icon: string;
  label: string;
  color: string;
}

export const PHASE_LABELS: { [key: string]: PhaseInfo } = {
  // 游戏流程
  'lobby': { icon: '⏳', label: '大厅', color: 'gray' },
  'settle': { icon: '⚖️', label: '夜间结算', color: 'purple' },
  'daySettle': { icon: '☀️', label: '白天结算', color: 'yellow' },
  'finished': { icon: '🏁', label: '游戏结束', color: 'green' },

  // 投票相关
  'sheriffElection': { icon: '🎖️', label: '警长竞选', color: 'yellow' },
  'sheriffCampaign': { icon: '🗣️', label: '警长发言', color: 'yellow' },
  'sheriffVote': { icon: '🗳️', label: '警长投票', color: 'yellow' },
  'discussion': { icon: '💬', label: '讨论发言', color: 'blue' },
  'vote': { icon: '🗳️', label: '投票放逐', color: 'red' },
  'voteResult': { icon: '📊', label: '投票结果', color: 'red' },

  // 角色技能阶段
  'fear': { icon: '🌙', label: '恐惧 (噩梦之影)', color: 'purple' },
  'dream': { icon: '💤', label: '摄梦 (摄梦人)', color: 'blue' },
  'gargoyle': { icon: '🗿', label: '查验 (石像鬼)', color: 'purple' },
  'guard': { icon: '🛡️', label: '守护 (守卫)', color: 'blue' },
  'wolf': { icon: '🐺', label: '狼人刀人', color: 'red' },
  'wolf_beauty': { icon: '💃', label: '魅惑 (狼美人)', color: 'pink' },
  'witch': { icon: '🧪', label: '女巫用药', color: 'green' },
  'seer': { icon: '🔮', label: '预言家查验', color: 'cyan' },
  'gravekeeper': { icon: '⚰️', label: '守墓 (守墓人)', color: 'gray' },
  'hunter': { icon: '🏹', label: '猎人开枪', color: 'orange' },
  'knight': { icon: '⚔️', label: '骑士决斗', color: 'gold' },
};

/**
 * 获取阶段标签
 */
export function getPhaseLabel(phase: string): string {
  const phaseInfo = PHASE_LABELS[phase];
  if (phaseInfo) {
    return `${phaseInfo.icon} ${phaseInfo.label}`;
  }
  return phase;
}

/**
 * 获取阶段图标
 */
export function getPhaseIcon(phase: string): string {
  return PHASE_LABELS[phase]?.icon || '❓';
}

/**
 * 获取阶段颜色类名
 */
export function getPhaseColorClass(phase: string): string {
  const color = PHASE_LABELS[phase]?.color || 'gray';
  return `border-${color}-500 bg-${color}-600/20`;
}

/**
 * 翻译死亡原因
 * 注意: 枚举值必须与后端 SkillTypes.ts 中的 DeathReason 枚举保持一致
 */
export function translateDeathReason(reason?: string): string {
  const translations: { [key: string]: string } = {
    // 后端 DeathReason 枚举 (snake_case)
    'wolf_kill': '🐺 被狼刀',
    'poison': '☠️ 被毒死',
    'exile': '🗳️ 被投票放逐',
    'hunter_shoot': '🏹 被猎人带走',
    'dream_kill': '💤 摄梦人梦死',
    'black_wolf_explode': '💥 黑狼自爆',
    'knight_duel': '⚔️ 被骑士决斗',
    'wolf_beauty_link': '💃 与狼美人殉情',
    'self_destruct': '💣 狼人自爆',
    'guard_save_conflict': '💔 奶穿（同守同救）',

    // 兼容旧格式 (camelCase) - 逐步废弃
    'wolfKill': '🐺 被狼刀',
    'vote': '🗳️ 被投票放逐',
    'dreamerKilled': '💤 摄梦人梦死',
    'hunter': '🏹 被猎人带走',
    'knight': '⚔️ 被骑士决斗',
    'wolfBeauty': '💃 与狼美人殉情',
  };
  return translations[reason || ''] || reason || '未知原因';
}

/**
 * 阶段操作提示（告诉上帝当前步骤应该做什么）
 */
export const PHASE_HINTS: Record<string, string> = {
  fear: '请让噩梦之影选择恐惧目标',
  dream: '请让摄梦人选择梦游目标',
  gargoyle: '请让石像鬼选择查验目标',
  guard: '请让守卫选择守护目标',
  wolf: '请等待狼人商议并选择刀人目标',
  wolf_beauty: '请让狼美人选择魅惑目标',
  witch: '请等待女巫决定是否用药',
  seer: '请等待预言家查验',
  gravekeeper: '请让守墓人选择验尸目标',
  settle: '夜间结算完成，请宣布昨晚结果',
  sheriffElection: '警长竞选阶段，请操作上警/发言/投票流程',
  sheriffCampaign: '警长竞选发言中',
  sheriffVote: '警长竞选投票中',
  discussion: '白天讨论阶段，请主持发言顺序',
  vote: '投票放逐阶段，请引导玩家投票',
  daySettle: '白天结算中',
  hunter: '猎人死亡，请等待猎人选择开枪目标',
  knight: '骑士发起决斗',
  lobby: '等待玩家加入',
  finished: '游戏已结束',
};

/**
 * 获取阶段操作提示
 */
export function getPhaseHint(phase: string): string {
  return PHASE_HINTS[phase] || '';
}

/**
 * 获取角色中文名
 */
export function getRoleName(roleId: string): string {
  const roleNames: { [key: string]: string } = {
    'wolf': '狼人',
    'nightmare': '噩梦之影',
    'wolf_beauty': '狼美人',
    'white_wolf': '白狼王',
    'black_wolf': '黑狼',
    'gargoyle': '石像鬼',
    'seer': '预言家',
    'witch': '女巫',
    'hunter': '猎人',
    'guard': '守卫',
    'gravekeeper': '守墓人',
    'knight': '骑士',
    'dreamer': '摄梦人',
    'villager': '平民',
  };
  return roleNames[roleId] || roleId;
}
