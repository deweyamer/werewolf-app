import { useState } from 'react';
import { GamePlayer } from '../../../../shared/src/types';
import { translateDeathReason } from '../../utils/phaseLabels';

interface PlayerRingProps {
  players: GamePlayer[];
  myPlayerId: number;
  sheriffId: number;
  className?: string;
}

export default function PlayerRing({ players, myPlayerId, sheriffId, className = '' }: PlayerRingProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  // 按座位号排列，补齐到12位
  const seats = Array.from({ length: 12 }, (_, i) => {
    const seatId = i + 1;
    return players.find(p => p.playerId === seatId) || null;
  });

  return (
    <div className={`relative ${className}`}>
      <div className="grid grid-cols-6 gap-1">
        {seats.map((player, idx) => {
          const seatId = idx + 1;
          const isSelf = player?.playerId === myPlayerId;
          const isSheriff = player?.playerId === sheriffId;

          return (
            <button
              key={seatId}
              onClick={() => player && setSelectedPlayer(selectedPlayer === seatId ? null : seatId)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold relative transition-all ${
                !player
                  ? 'bg-gray-800/50 text-gray-700'
                  : !player.alive
                    ? 'bg-gray-700/30 text-gray-600'
                    : isSelf
                      ? 'bg-blue-600/40 text-blue-200 ring-2 ring-blue-400'
                      : 'bg-white/10 text-gray-300'
              }`}
              disabled={!player}
            >
              {seatId}
              {player && !player.alive && (
                <span className="absolute inset-0 flex items-center justify-center text-red-500/50 text-base">✕</span>
              )}
              {isSheriff && (
                <span className="absolute -top-1 -right-0.5 text-yellow-400 text-[8px] leading-none">★</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 迷你浮窗 */}
      {selectedPlayer && (() => {
        const player = players.find(p => p.playerId === selectedPlayer);
        if (!player) return null;
        return (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800/95 border border-white/10 rounded-lg shadow-lg whitespace-nowrap z-50">
            <span className="text-white text-xs font-bold">{player.playerId}号</span>
            <span className="text-gray-400 text-xs ml-1">{player.username}</span>
            <span className={`text-xs ml-1.5 ${player.alive ? 'text-green-400' : 'text-red-400'}`}>
              {player.alive ? '存活' : translateDeathReason(player.outReason)}
            </span>
            {player.isSheriff && <span className="text-yellow-400 text-xs ml-1">★警长</span>}
          </div>
        );
      })()}
    </div>
  );
}
