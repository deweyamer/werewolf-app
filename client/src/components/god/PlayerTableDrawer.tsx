import { X } from 'lucide-react';
import { PlayerStats } from '../../utils/gameStats';

interface PlayerTableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playerStats: PlayerStats[];
}

export default function PlayerTableDrawer({
  isOpen,
  onClose,
  playerStats,
}: PlayerTableDrawerProps) {
  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[85%] sm:max-w-4xl bg-gray-900 border-l border-white/20 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between px-4 py-3 sm:p-6 border-b border-white/20">
          <h2 className="text-lg sm:text-2xl font-bold text-white">玩家详细状态</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="text-white" size={20} />
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="px-3 py-3 sm:p-6 overflow-y-auto h-[calc(100vh-56px)] sm:h-[calc(100vh-80px)]">

          {/* 移动端卡片布局 */}
          <div className="sm:hidden space-y-2">
            {playerStats.map((player) => (
              <div
                key={player.playerId}
                className={`rounded-lg border border-white/10 p-3 ${
                  !player.alive ? 'opacity-50 bg-white/[0.02]' : 'bg-white/5'
                }`}
              >
                {/* 卡片头：号位 + 玩家名 + 状态 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">
                      {player.playerId}号
                      {player.isSheriff && ' 🎖️'}
                    </span>
                    <span className="text-gray-400 text-xs">{player.username}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] ${
                      player.alive
                        ? 'bg-green-600/30 text-green-300'
                        : 'bg-gray-600/30 text-gray-400'
                    }`}
                  >
                    {player.alive ? '存活' : '已出局'}
                  </span>
                </div>
                {/* 卡片体：角色 + 阵营 + 技能 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] ${
                      player.camp === 'wolf'
                        ? 'bg-red-600/30 text-red-300'
                        : 'bg-blue-600/30 text-blue-300'
                    }`}
                  >
                    {player.roleName}
                  </span>
                  {player.role && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        player.camp === 'wolf'
                          ? 'bg-red-600/50 text-red-200'
                          : 'bg-green-600/50 text-green-200'
                      }`}
                    >
                      {player.camp === 'wolf' ? '狼人' : '好人'}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">技能 {player.actionCount} 次</span>
                </div>
                {/* 出局信息 */}
                {!player.alive && player.outReasonText && (
                  <div className="mt-2 pt-2 border-t border-white/5 text-xs text-gray-400">
                    {player.outReasonText}
                    {player.deathRound && (
                      <span className="text-gray-600 ml-2">第{player.deathRound}回合</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 桌面端表格布局 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="pb-3 text-gray-300 font-semibold">号位</th>
                  <th className="pb-3 text-gray-300 font-semibold">玩家名</th>
                  <th className="pb-3 text-gray-300 font-semibold">角色</th>
                  <th className="pb-3 text-gray-300 font-semibold">阵营</th>
                  <th className="pb-3 text-gray-300 font-semibold">状态</th>
                  <th className="pb-3 text-gray-300 font-semibold">技能次数</th>
                  <th className="pb-3 text-gray-300 font-semibold">出局信息</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((player) => (
                  <tr
                    key={player.playerId}
                    className={`border-b border-white/10 ${
                      !player.alive ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 text-white font-bold">
                      {player.playerId}号
                      {player.isSheriff && ' 🎖️'}
                    </td>
                    <td className="py-3 text-gray-300">{player.username}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          player.camp === 'wolf'
                            ? 'bg-red-600/30 text-red-300'
                            : 'bg-blue-600/30 text-blue-300'
                        }`}
                      >
                        {player.roleName}
                      </span>
                    </td>
                    <td className="py-3">
                      {player.role ? (
                        <span
                          className={`px-2 py-1 rounded text-sm font-bold ${
                            player.camp === 'wolf'
                              ? 'bg-red-600/50 text-red-200'
                              : 'bg-green-600/50 text-green-200'
                          }`}
                        >
                          {player.camp === 'wolf' ? '狼人' : '好人'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-sm text-gray-400">
                          未分配
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          player.alive
                            ? 'bg-green-600/30 text-green-300'
                            : 'bg-gray-600/30 text-gray-400'
                        }`}
                      >
                        {player.alive ? '存活' : '已出局'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300">{player.actionCount} 次</td>
                    <td className="py-3 text-gray-300">
                      {!player.alive && player.outReasonText && (
                        <div className="text-sm">
                          <div>{player.outReasonText}</div>
                          {player.deathRound && (
                            <div className="text-gray-500 text-xs">
                              第 {player.deathRound} 回合
                            </div>
                          )}
                        </div>
                      )}
                      {player.alive && '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
