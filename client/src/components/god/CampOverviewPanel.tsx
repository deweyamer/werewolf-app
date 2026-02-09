import { useState } from 'react';
import { ROLE_INFO } from '../../../../shared/src/constants';
import { getRoleName, translateDeathReason } from '../../utils/phaseLabels';
import type { Game, GamePlayer } from '../../../../shared/src/types';

/** 阵营存亡面板 — 按阵营分组 + 警长信息（加大显示） */
export default function CampOverviewPanel({ game }: { game: Game }) {
  const wolves = game.players.filter(p => p.camp === 'wolf');
  const gods = game.players.filter(p => p.camp === 'good' && ROLE_INFO[p.role]?.type === 'god');
  const civilians = game.players.filter(p => p.camp === 'good' && ROLE_INFO[p.role]?.type === 'civilian');

  const aliveW = wolves.filter(p => p.alive).length;
  const aliveG = gods.filter(p => p.alive).length;
  const aliveC = civilians.filter(p => p.alive).length;

  const [showDetails, setShowDetails] = useState(false);

  const renderGroup = (label: string, emoji: string, players: GamePlayer[], aliveCount: number, color: string) => (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color }}>{emoji} {label}</span>
        <span className="text-xs text-gray-500">{aliveCount}/{players.length}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${players.length > 0 ? (aliveCount / players.length) * 100 : 0}%`, backgroundColor: color }}
        />
      </div>
      {showDetails && (
        <div className="flex flex-wrap gap-1 mt-1">
          {players.map(p => (
            <span
              key={p.playerId}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                p.alive
                  ? 'bg-white/10 text-gray-300'
                  : 'bg-white/5 text-gray-600 line-through'
              }`}
              title={p.alive ? getRoleName(p.role) : `${getRoleName(p.role)} - ${translateDeathReason(p.outReason)}`}
            >
              {p.playerId}号{p.isSheriff ? ' 🎖️' : ''}{!p.alive && ' †'}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const sheriff = game.players.find(p => p.playerId === game.sheriffId);

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
      <button
        className="w-full px-3 py-2 border-b border-white/10 flex items-center justify-between hover:bg-white/5 transition"
        onClick={() => setShowDetails(!showDetails)}
      >
        <h3 className="text-sm font-bold text-white">阵营存亡</h3>
        <span className="text-[10px] text-gray-500">{showDetails ? '收起' : '展开详情'}</span>
      </button>
      <div className="p-3">
        {renderGroup('狼人', '🐺', wolves, aliveW, '#ef4444')}
        {renderGroup('神职', '🛡', gods, aliveG, '#3b82f6')}
        {renderGroup('平民', '👤', civilians, aliveC, '#6b7280')}

        {/* 警长信息 — 加大醒目显示 */}
        {game.sheriffId > 0 && sheriff && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="text-lg">🎖️</span>
              <div>
                <div className="text-sm font-bold text-yellow-300">
                  警长: {game.sheriffId}号
                </div>
                <div className="text-[11px] text-yellow-200/60">{sheriff.username} · {getRoleName(sheriff.role)}</div>
              </div>
            </div>
          </div>
        )}
        {game.sheriffBadgeState === 'destroyed' && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-500/10 border border-gray-500/30 rounded-lg">
              <span className="text-base">🚫</span>
              <span className="text-xs text-gray-400">警徽已流失</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
