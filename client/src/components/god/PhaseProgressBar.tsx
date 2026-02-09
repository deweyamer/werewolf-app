import type { Game } from '../../../../shared/src/types';

/** 夜晚操作进度指示器 — 只在夜晚显示 */
export default function PhaseProgressBar({ game }: { game: Game }) {
  const na = game.nightActions;
  const roleSubmitMap: { role: string; label: string; submitted: boolean | undefined }[] = [];
  const playerRoles = new Set(game.players.filter(p => p.alive).map(p => p.role));

  if (playerRoles.has('nightmare') && game.currentRound === 1) roleSubmitMap.push({ role: 'nightmare', label: '恐惧', submitted: na.fearSubmitted });
  if (playerRoles.has('dreamer')) roleSubmitMap.push({ role: 'dreamer', label: '摄梦', submitted: na.dreamSubmitted });
  if (playerRoles.has('gargoyle')) roleSubmitMap.push({ role: 'gargoyle', label: '石像鬼', submitted: na.gargoyleSubmitted });
  if (playerRoles.has('guard')) roleSubmitMap.push({ role: 'guard', label: '守卫', submitted: na.guardSubmitted });
  roleSubmitMap.push({ role: 'wolf', label: '狼人', submitted: na.wolfSubmitted });
  if (playerRoles.has('wolf_beauty')) roleSubmitMap.push({ role: 'wolf_beauty', label: '狼美人', submitted: na.wolfBeautySubmitted });
  if (playerRoles.has('witch')) roleSubmitMap.push({ role: 'witch', label: '女巫', submitted: na.witchSubmitted });
  if (playerRoles.has('seer')) roleSubmitMap.push({ role: 'seer', label: '预言家', submitted: na.seerSubmitted });
  if (playerRoles.has('gravekeeper')) roleSubmitMap.push({ role: 'gravekeeper', label: '守墓人', submitted: na.gravekeeperSubmitted });

  const total = roleSubmitMap.length;
  const done = roleSubmitMap.filter(r => r.submitted === true).length;

  if (game.currentPhaseType !== 'night') return null;

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/5 rounded-xl border border-white/10">
      <span className="text-xs text-gray-400 whitespace-nowrap font-medium">{done}/{total} 已操作</span>
      <div className="flex gap-1.5 flex-1 flex-wrap">
        {roleSubmitMap.map((r) => (
          <span
            key={r.role}
            className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full transition-all ${
              r.submitted === true
                ? 'bg-green-500/30 text-green-300 border border-green-500/40'
                : 'bg-white/5 text-gray-500 border border-white/10'
            }`}
          >
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
