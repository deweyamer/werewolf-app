import { GameOverviewStats, PlayerStats } from '../../utils/gameStats';
import { getPhaseLabel } from '../../utils/phaseLabels';
import { Eye } from 'lucide-react';

interface MiniOverviewSidebarProps {
  gameOverview: GameOverviewStats;
  playerStats: PlayerStats[];
  onOpenDrawer: () => void;
}

export default function MiniOverviewSidebar({
  gameOverview,
  playerStats,
  onOpenDrawer,
}: MiniOverviewSidebarProps) {
  const totalWolves = gameOverview.aliveWolves + gameOverview.deadWolves;
  const totalGoods = gameOverview.aliveGoods + gameOverview.deadGoods;

  return (
    <div className="space-y-4">
      {/* 存活统计 */}
      <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
        <h3 className="text-lg font-bold text-white mb-3">存活统计</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-red-600/20 border border-red-500/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">
              {gameOverview.aliveWolves}/{totalWolves}
            </div>
            <div className="text-red-300 text-sm">存活狼人</div>
          </div>
          <div className="p-3 bg-green-600/20 border border-green-500/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">
              {gameOverview.aliveGoods}/{totalGoods}
            </div>
            <div className="text-green-300 text-sm">存活好人</div>
          </div>
        </div>
        <div className="text-gray-300 text-sm space-y-1">
          <div className="flex justify-between">
            <span>当前回合</span>
            <span className="text-white font-medium">第 {gameOverview.currentRound} 轮</span>
          </div>
          <div className="flex justify-between">
            <span>当前阶段</span>
            <span className="text-white font-medium">{getPhaseLabel(gameOverview.currentPhase)}</span>
          </div>
          {gameOverview.duration && (
            <div className="flex justify-between">
              <span>游戏时长</span>
              <span className="text-white font-medium">{gameOverview.duration}</span>
            </div>
          )}
        </div>
      </div>

      {/* 简化玩家列表 */}
      <div className="p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex flex-col">
        <h3 className="text-lg font-bold text-white mb-3">玩家状态</h3>
        <div className="space-y-2 max-h-[350px] overflow-y-auto flex-1">
          {playerStats.map((player) => (
            <div
              key={player.playerId}
              className={`p-2 rounded-lg flex items-center justify-between ${
                player.alive ? 'bg-white/5' : 'bg-gray-800/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    player.camp === 'wolf'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {player.playerId}
                </span>
                <span className="text-white text-sm">
                  {player.roleName}
                  {player.isSheriff && ' 🎖️'}
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  player.alive ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {player.alive ? '存活' : '出局'}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={onOpenDrawer}
          className="mt-4 w-full py-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg transition flex items-center justify-center gap-2 border border-blue-500/30"
        >
          <Eye size={16} />
          查看完整表格
        </button>
      </div>
    </div>
  );
}
