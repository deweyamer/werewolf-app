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
 */
export function translateDeathReason(reason?: string): string {
  const translations: { [key: string]: string } = {
    'wolfKill': '🐺 被狼刀',
    'poison': '☠️ 被毒死',
    'vote': '🗳️ 被投票放逐',
    'dreamerKilled': '💤 摄梦人梦死',
    'hunter': '🏹 被猎人带走',
    'knight': '⚔️ 被骑士决斗',
    'wolfBeauty': '💃 与狼美人殉情',
  };
  return translations[reason || ''] || reason || '未知原因';
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
