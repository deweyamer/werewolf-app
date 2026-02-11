import type { Game } from '../../../../shared/src/types';

/** 夜晚操作卡片网格 — 只显示本局存在的角色 */
export default function NightActionCards({ game }: { game: Game }) {
  const na = game.nightActions;
  const aliveRoles = new Set(game.players.filter(p => p.alive).map(p => p.role));

  interface ActionCard {
    role: string;
    label: string;
    icon: string;
    submitted: boolean | undefined;
    detail: string;
    color: string;
  }

  const cards: ActionCard[] = [];

  if (aliveRoles.has('nightmare') && game.currentRound === 1) {
    cards.push({ role: 'nightmare', label: '噩梦之影', icon: '🌙', submitted: na.fearSubmitted, detail: na.fear ? `恐惧 ${na.fear}号` : '等待操作...', color: 'purple' });
  }
  if (aliveRoles.has('dreamer')) {
    cards.push({ role: 'dreamer', label: '摄梦人', icon: '💤', submitted: na.dreamSubmitted, detail: na.dream ? `梦游 ${na.dream}号` : '等待操作...', color: 'blue' });
  }
  if (aliveRoles.has('gargoyle')) {
    cards.push({ role: 'gargoyle', label: '石像鬼', icon: '🗿', submitted: na.gargoyleSubmitted, detail: na.gargoyleTarget ? `查验 ${na.gargoyleTarget}号` : '等待操作...', color: 'purple' });
  }
  if (aliveRoles.has('guard')) {
    const guardPlayer = game.players.find(p => p.role === 'guard' && p.alive);
    const guardHistory: number[] = guardPlayer?.abilities.guardHistory || [];
    const historyStr = guardHistory.length > 0
      ? guardHistory.map((t, i) => `R${i + 1}:${t === 0 ? '空手' : t + '号'}`).join(' ')
      : '';
    const currentDetail = na.guardSubmitted ? (na.guardTarget ? `守护 ${na.guardTarget}号` : '空手') : '等待操作...';
    const detail = historyStr ? `${currentDetail} | 历史: ${historyStr}` : currentDetail;
    cards.push({ role: 'guard', label: '守卫', icon: '🛡️', submitted: na.guardSubmitted, detail, color: 'blue' });
  }
  cards.push({ role: 'wolf', label: '狼人', icon: '🐺', submitted: na.wolfSubmitted, detail: na.wolfKill ? `击杀 ${na.wolfKill}号` : '商议中...', color: 'red' });
  if (aliveRoles.has('wolf_beauty')) {
    cards.push({ role: 'wolf_beauty', label: '狼美人', icon: '💃', submitted: na.wolfBeautySubmitted, detail: na.wolfBeautyTarget ? `魅惑 ${na.wolfBeautyTarget}号` : '等待操作...', color: 'pink' });
  }
  if (aliveRoles.has('witch')) {
    cards.push({ role: 'witch', label: '女巫', icon: '🧪', submitted: na.witchSubmitted, detail: na.witchAction === 'save' ? '解药救人' : na.witchAction === 'poison' ? `毒杀 ${na.witchTarget}号` : na.witchAction === 'none' ? '未用药' : '等待操作...', color: 'green' });
  }
  if (aliveRoles.has('seer')) {
    cards.push({ role: 'seer', label: '预言家', icon: '🔮', submitted: na.seerSubmitted, detail: na.seerCheck ? `查验 ${na.seerCheck}号 → ${na.seerResult === 'wolf' ? '狼人' : '好人'}` : '等待操作...', color: 'cyan' });
  }
  if (aliveRoles.has('gravekeeper')) {
    cards.push({ role: 'gravekeeper', label: '守墓人', icon: '⚰️', submitted: na.gravekeeperSubmitted, detail: na.gravekeeperTarget ? `验尸 ${na.gravekeeperTarget}号` : '等待操作...', color: 'gray' });
  }

  const colorMap: Record<string, string> = {
    purple: 'border-purple-500/40 bg-purple-500/10',
    blue: 'border-blue-500/40 bg-blue-500/10',
    red: 'border-red-500/40 bg-red-500/10',
    pink: 'border-pink-500/40 bg-pink-500/10',
    green: 'border-green-500/40 bg-green-500/10',
    cyan: 'border-cyan-500/40 bg-cyan-500/10',
    gray: 'border-gray-500/40 bg-gray-500/10',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
      {cards.map((card) => {
        const isCurrentPhaseRole =
          (game.currentPhase === 'wolf' && (card.role === 'wolf' || card.role === 'nightmare')) ||
          game.currentPhase === card.role;
        return (
          <div
            key={card.role}
            className={`relative p-2.5 sm:p-3 rounded-xl border transition-all ${colorMap[card.color] || colorMap.gray} ${
              isCurrentPhaseRole ? 'ring-2 ring-yellow-400/60 shadow-lg shadow-yellow-500/10' : ''
            }`}
          >
            {isCurrentPhaseRole && (
              <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 bg-yellow-500 text-black rounded-full font-bold">
                当前
              </span>
            )}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base sm:text-lg">{card.icon}</span>
              <span className="text-white font-semibold text-xs sm:text-sm">{card.label}</span>
              <span className={`ml-auto text-[11px] sm:text-xs px-1.5 py-0.5 rounded-full ${
                card.submitted ? 'bg-green-500/30 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
              }`}>
                {card.submitted ? '已完成' : '等待中'}
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs ${card.submitted ? 'text-gray-300' : 'text-gray-500'}`}>
              {card.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
