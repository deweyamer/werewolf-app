import { useState, useEffect, useRef } from 'react';
import { GamePlayer, Game } from '../../../../shared/src/types';
import { getRoleName } from '../../utils/phaseLabels';

const ROLE_ICONS: Record<string, string> = {
  wolf: '🐺', seer: '👁', witch: '⚗', hunter: '🎯', guard: '🛡',
  villager: '👤', nightmare: '😱', dreamer: '💤', knight: '⚔',
  gravekeeper: '⚰', gargoyle: '🗿', wolf_beauty: '💋',
  white_wolf: '👑', black_wolf: '🖤',
};

interface RolePeekProps {
  myPlayer: GamePlayer;
  game: Game;
}

export default function RolePeek({ myPlayer, game }: RolePeekProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const toggleReveal = () => {
    if (isRevealed) {
      setIsRevealed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      setIsRevealed(true);
      timerRef.current = setTimeout(() => setIsRevealed(false), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!myPlayer.role) return null;

  const icon = ROLE_ICONS[myPlayer.role] || '❓';
  const isWolf = myPlayer.camp === 'wolf';

  return (
    <div className="relative ml-2">
      <button
        onClick={toggleReveal}
        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
        title="查看身份"
      >
        👁
      </button>

      {isRevealed && (
        <div
          className={`absolute bottom-full right-0 mb-2 p-3 bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border-2 ${
            isWolf ? 'border-red-500/60' : 'border-green-500/60'
          } animate-fadeInUp`}
        >
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xl">{icon}</span>
            <div>
              <div className="text-white text-sm font-bold">{getRoleName(myPlayer.role)}</div>
              <div className={`text-xs ${isWolf ? 'text-red-400' : 'text-green-400'}`}>
                {isWolf ? '狼人阵营' : '好人阵营'}
              </div>
            </div>
          </div>

          {/* 女巫药水状态 */}
          {myPlayer.role === 'witch' && game.status === 'running' && myPlayer.alive && (
            <div className="flex gap-3 mt-2 text-xs">
              <span className={myPlayer.abilities.antidote ? 'text-green-400' : 'text-gray-600'}>
                ● 解药
              </span>
              <span className={myPlayer.abilities.poison ? 'text-red-400' : 'text-gray-600'}>
                ● 毒药
              </span>
            </div>
          )}

          {/* 守卫上晚守护 */}
          {myPlayer.role === 'guard' && myPlayer.abilities.guardHistory && myPlayer.abilities.guardHistory.length > 0 && (
            <div className="mt-2 text-xs text-gray-400">
              上晚: {(() => {
                const last = myPlayer.abilities.guardHistory[myPlayer.abilities.guardHistory.length - 1];
                return last === 0 ? '空守' : `${last}号`;
              })()}
            </div>
          )}

          {/* 摄梦人上晚梦游 */}
          {myPlayer.role === 'dreamer' && myPlayer.abilities.lastDreamTarget && (
            <div className="mt-2 text-xs text-gray-400">
              上晚: {myPlayer.abilities.lastDreamTarget}号
            </div>
          )}
        </div>
      )}
    </div>
  );
}
