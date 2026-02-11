import { useState } from 'react';
import { Game, GamePlayer } from '../../../../shared/src/types';
import { getPhaseIcon } from '../../utils/phaseLabels';

// 简短阶段标签（不含 emoji，TopBar 自己管 icon）
const SHORT_PHASE_LABELS: Record<string, string> = {
  lobby: '大厅',
  fear: '夜晚', dream: '夜晚', gargoyle: '夜晚', guard: '夜晚',
  wolf: '夜晚', wolf_beauty: '夜晚', witch: '夜晚', seer: '夜晚',
  gravekeeper: '夜晚', settle: '结算',
  sheriffElection: '竞选', sheriffCampaign: '竞选', sheriffVote: '竞选',
  discussion: '讨论', vote: '投票', voteResult: '结果',
  hunter: '猎人', knight: '决斗', daySettle: '结算',
  finished: '结束',
};

interface TopBarProps {
  myPlayer: GamePlayer;
  game: Game;
  onLeaveRoom: () => void;
}

export default function TopBar({ myPlayer, game, onLeaveRoom }: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false);

  const phaseIcon = game.currentPhaseType === 'night' ? '🌙' : '☀';
  const shortLabel = SHORT_PHASE_LABELS[game.currentPhase] || game.currentPhase;

  return (
    <>
      <div className="h-12 flex items-center justify-between px-3 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 fixed top-0 left-0 right-0 z-40">
        {/* 左: 座位号 + 警长 */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-200 text-sm font-bold">
            {myPlayer.playerId}号
          </span>
          {myPlayer.isSheriff && (
            <span className="text-yellow-400 text-sm">★</span>
          )}
          {!myPlayer.alive && (
            <span className="text-gray-500 text-xs">已出局</span>
          )}
        </div>

        {/* 中: 回合 + 阶段 */}
        <div className="text-white text-sm font-medium">
          {game.status === 'running' ? (
            <span>R{game.currentRound} · {phaseIcon} {shortLabel}</span>
          ) : game.status === 'finished' ? (
            <span>🏁 已结束</span>
          ) : (
            <span>等待开始</span>
          )}
        </div>

        {/* 右: 房间码 + 菜单 */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs font-mono">{game.roomCode}</span>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* 下拉菜单 */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="fixed top-12 right-2 z-50 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px]">
            <div className="px-3 py-2 text-gray-400 text-xs border-b border-white/5">
              {game.scriptName}
            </div>
            <button
              onClick={() => { setShowMenu(false); onLeaveRoom(); }}
              className="w-full px-3 py-2 text-left text-red-400 text-sm hover:bg-white/5 transition"
            >
              离开房间
            </button>
          </div>
        </>
      )}
    </>
  );
}
