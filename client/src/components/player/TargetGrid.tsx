import { GamePlayer } from '../../../../shared/src/types';

interface TargetGridProps {
  players: GamePlayer[];
  myPlayerId: number;
  selected: number;
  onSelect: (playerId: number) => void;
  includeSelf?: boolean;
  excludeIds?: number[];
}

export default function TargetGrid({
  players,
  myPlayerId,
  selected,
  onSelect,
  includeSelf = false,
  excludeIds = [],
}: TargetGridProps) {
  const targets = players.filter(p =>
    p.alive &&
    (includeSelf || p.playerId !== myPlayerId) &&
    !excludeIds.includes(p.playerId)
  );

  return (
    <div className="grid grid-cols-4 gap-2">
      {targets.map(p => (
        <button
          key={p.playerId}
          onClick={() => onSelect(p.playerId === selected ? 0 : p.playerId)}
          className={`h-12 rounded-lg text-sm font-bold transition ${
            selected === p.playerId
              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
              : 'bg-white/10 text-gray-300 active:bg-white/20'
          }`}
        >
          {p.playerId}
        </button>
      ))}
    </div>
  );
}
