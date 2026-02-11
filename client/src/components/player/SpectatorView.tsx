import { Game, GamePlayer } from '../../../../shared/src/types';
import { getPhaseLabel } from '../../utils/phaseLabels';
import { getRoleName } from '../../utils/phaseLabels';

interface SpectatorViewProps {
  game: Game;
  myPlayer: GamePlayer;
}

export default function SpectatorView({ game, myPlayer }: SpectatorViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-3xl mb-2 opacity-50">👻</div>
      <h3 className="text-lg font-bold text-gray-400 mb-1">观战中</h3>
      <p className="text-gray-500 text-sm mb-6">你已出局</p>

      <div className="w-full max-w-xs space-y-3">
        <div className="p-3 bg-white/5 rounded-lg">
          <div className="text-gray-500 text-xs mb-1">当前阶段</div>
          <div className="text-white text-sm font-medium">
            第 {game.currentRound} 回合 · {getPhaseLabel(game.currentPhase)}
          </div>
        </div>

        <div className="p-3 bg-white/5 rounded-lg">
          <div className="text-gray-500 text-xs mb-1">你的身份</div>
          <div className="text-gray-300 text-sm">
            {myPlayer.playerId}号 · {getRoleName(myPlayer.role)} · {myPlayer.camp === 'wolf' ? '狼人阵营' : '好人阵营'}
          </div>
        </div>

        <div className="p-3 bg-white/5 rounded-lg">
          <div className="text-gray-500 text-xs mb-1">
            存活 {game.players.filter(p => p.alive).length}/{game.players.length}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {game.players.map(p => (
              <span
                key={p.playerId}
                className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                  p.alive
                    ? 'bg-green-600/20 text-green-300'
                    : 'bg-gray-600/20 text-gray-500 line-through'
                }`}
              >
                {p.playerId}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
