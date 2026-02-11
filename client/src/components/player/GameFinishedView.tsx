import { Game } from '../../../../shared/src/types';

interface GameFinishedViewProps {
  game: Game;
}

export default function GameFinishedView({ game }: GameFinishedViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <div className="text-3xl mb-3">🏁</div>
      <h3 className="text-2xl font-bold text-white mb-2">游戏结束</h3>
      <p className={`text-xl font-bold ${game.winner === 'wolf' ? 'text-red-400' : 'text-green-400'}`}>
        {game.winner === 'wolf' ? '狼人阵营' : '好人阵营'} 获胜
      </p>
    </div>
  );
}
