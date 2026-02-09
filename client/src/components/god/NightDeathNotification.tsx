import { Game } from '../../../../shared/src/types';
import { getRoleName, translateDeathReason } from '../../utils/phaseLabels';

interface NightDeathNotificationProps {
  currentGame: Game;
  round?: number;
  onDismiss?: () => void;
}

export default function NightDeathNotification({ currentGame, round, onDismiss }: NightDeathNotificationProps) {
  const roundHistory = currentGame.roundHistory;
  if (!roundHistory || roundHistory.length === 0) return null;

  const entry = round
    ? roundHistory.find(h => h.round === round)
    : roundHistory[roundHistory.length - 1];

  if (!entry) return null;

  const deaths = entry.deaths;
  const hasDeath = deaths.length > 0;

  return (
    <div className={`backdrop-blur-md rounded-2xl p-6 shadow-2xl border-2 ${
      hasDeath
        ? 'bg-red-600/20 border-red-500/70'
        : 'bg-green-600/20 border-green-500/70'
    }`}>
      <div className="flex justify-between items-start">
        <h4 className={`text-2xl font-bold ${hasDeath ? 'text-red-400' : 'text-green-400'}`}>
          {hasDeath ? '💀 昨晚死亡' : '✨ 平安夜'}
        </h4>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {hasDeath ? (
        <div className="mt-4 space-y-3">
          {deaths.map(playerId => {
            const player = currentGame.players.find(p => p.playerId === playerId);
            return (
              <div key={playerId} className="flex items-center gap-4 p-3 bg-red-600/10 rounded-lg">
                <span className="w-10 h-10 rounded-full bg-red-600/50 flex items-center justify-center text-white font-bold text-lg">
                  {playerId}
                </span>
                <div>
                  <div className="text-white font-bold text-lg">
                    {playerId}号 — {getRoleName(player?.role || '')}
                  </div>
                  <div className="text-red-300 text-sm">
                    {translateDeathReason(player?.outReason)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-green-300 text-lg mt-3">昨晚无人死亡</p>
      )}
    </div>
  );
}
