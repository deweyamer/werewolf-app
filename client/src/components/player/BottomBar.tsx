import { Game, GamePlayer } from '../../../../shared/src/types';
import PlayerRing from './PlayerRing';
import RolePeek from './RolePeek';

interface BottomBarProps {
  game: Game;
  myPlayer: GamePlayer;
}

export default function BottomBar({ game, myPlayer }: BottomBarProps) {
  return (
    <div className="h-16 flex items-center bg-gray-900/95 backdrop-blur-sm border-t border-white/10 fixed bottom-0 left-0 right-0 z-40 px-2">
      <PlayerRing
        players={game.players}
        myPlayerId={myPlayer.playerId}
        sheriffId={game.sheriffId}
        className="flex-1"
      />
      <RolePeek myPlayer={myPlayer} game={game} />
    </div>
  );
}
