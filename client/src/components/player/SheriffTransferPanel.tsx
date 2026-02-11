import { Game, GamePlayer } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';

interface SheriffTransferPanelProps {
  game: Game;
  myPlayer: GamePlayer;
}

export default function SheriffTransferPanel({ game, myPlayer }: SheriffTransferPanelProps) {
  const transfer = game.pendingSheriffTransfer;
  if (!transfer || transfer.fromPlayerId !== myPlayer.playerId || transfer.reason !== 'death') {
    return null;
  }

  return (
    <div className="p-4">
      <h3 className="text-base font-bold text-yellow-400 mb-3">警徽传递</h3>
      <p className="text-gray-400 text-sm mb-3">选择传递目标或撕毁警徽</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {transfer.options.map(playerId => {
          const player = game.players.find(p => p.playerId === playerId);
          return (
            <button
              key={playerId}
              onClick={() => wsService.send({ type: 'SHERIFF_TRANSFER', targetId: playerId })}
              className="p-3 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500/50 rounded-lg transition"
            >
              <div className="text-white font-bold text-sm">{playerId}号</div>
              <div className="text-gray-400 text-xs">{player?.username}</div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => wsService.send({ type: 'SHERIFF_TRANSFER', targetId: 'destroy' })}
        className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition"
      >
        撕毁警徽
      </button>
    </div>
  );
}
