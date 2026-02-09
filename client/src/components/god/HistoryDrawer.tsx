import { useState } from 'react';
import { getPhaseLabel } from '../../utils/phaseLabels';
import type { Game } from '../../../../shared/src/types';

/** 历史回溯 Drawer — 从左侧滑出，半透明遮罩 */
export default function HistoryDrawer({ game, open, onClose }: { game: Game; open: boolean; onClose: () => void }) {
  const [selectedRound, setSelectedRound] = useState(1);
  const [filter, setFilter] = useState<'all' | 'skill' | 'death' | 'vote'>('all');

  const roundEntry = (game.roundHistory || []).find(r => r.round === selectedRound);
  const roundLogs = game.history.filter(h => h.round === selectedRound);

  const filteredLogs = roundLogs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'skill') return ['fear', 'dream', 'guard', 'wolf_kill', 'witch_save', 'witch_poison', 'seer_check', 'gravekeeper_check'].includes(log.action);
    if (filter === 'death') return log.result.includes('死亡') || log.result.includes('出局') || log.result.includes('杀害');
    if (filter === 'vote') return log.action === 'exile' || log.phase === 'vote' || log.phase === 'sheriffVote';
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-out
          w-full sm:w-[85vw] md:w-[50vw] lg:w-[40vw] max-w-lg
          bg-gray-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-base font-bold text-white">历史回溯</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg transition">✕</button>
        </div>

        {/* Round selector */}
        <div className="shrink-0 px-4 py-2 border-b border-white/10 flex gap-2 overflow-x-auto">
          {Array.from({ length: game.currentRound }, (_, i) => i + 1).map(round => (
            <button
              key={round}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedRound === round
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
              onClick={() => setSelectedRound(round)}
            >
              第{round}轮{round === game.currentRound ? ' (当前)' : ''}
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="shrink-0 px-4 py-2 border-b border-white/10 flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: '全部' },
            { key: 'skill', label: '技能' },
            { key: 'death', label: '出局' },
            { key: 'vote', label: '投票' },
          ].map(f => (
            <button
              key={f.key}
              className={`px-2.5 py-1 rounded-full text-[11px] transition ${
                filter === f.key
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => setFilter(f.key as typeof filter)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {roundEntry && (
            <div className="space-y-3">
              {/* 夜晚 */}
              <div className="flex items-center gap-2">
                <span className="text-sm">🌙</span>
                <h4 className="text-sm font-bold text-indigo-300">第{selectedRound}轮 · 夜晚</h4>
              </div>
              <div className="ml-6 space-y-1.5">
                {roundEntry.nightActions.fearSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-purple-400" />
                    🌙 噩梦之影 → 恐惧 {roundEntry.nightActions.fear}号
                  </div>
                )}
                {roundEntry.nightActions.dreamSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-300" />
                    💤 摄梦人 → 梦游 {roundEntry.nightActions.dream}号
                  </div>
                )}
                {roundEntry.nightActions.gargoyleSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-purple-300" />
                    🗿 石像鬼 → 查验 {roundEntry.nightActions.gargoyleTarget}号
                  </div>
                )}
                {roundEntry.nightActions.guardSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    🛡️ 守卫 → 守护 {roundEntry.nightActions.guardTarget}号
                  </div>
                )}
                {roundEntry.nightActions.wolfSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400" />
                    🐺 狼人 → 击杀 {roundEntry.nightActions.wolfKill}号
                  </div>
                )}
                {roundEntry.nightActions.wolfBeautySubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-pink-400" />
                    💃 狼美人 → 魅惑 {roundEntry.nightActions.wolfBeautyTarget}号
                  </div>
                )}
                {roundEntry.nightActions.witchSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-green-400" />
                    🧪 女巫 → {roundEntry.nightActions.witchAction === 'save' ? '使用解药' : roundEntry.nightActions.witchAction === 'poison' ? `毒杀 ${roundEntry.nightActions.witchTarget}号` : '未用药'}
                  </div>
                )}
                {roundEntry.nightActions.seerSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    🔮 预言家 → 查验 {roundEntry.nightActions.seerCheck}号 ({roundEntry.nightActions.seerResult === 'wolf' ? '狼人' : '好人'})
                  </div>
                )}
                {roundEntry.nightActions.gravekeeperSubmitted && (
                  <div className="text-xs text-gray-300 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                    ⚰️ 守墓人 → 验尸 {roundEntry.nightActions.gravekeeperTarget}号
                  </div>
                )}
                {roundEntry.settlementMessage && (
                  <div className="mt-2 text-xs text-yellow-300/80 bg-yellow-500/10 px-2 py-1 rounded">
                    ⚖️ {roundEntry.settlementMessage}
                  </div>
                )}
              </div>

              {/* 白天 */}
              {roundEntry.exileVote && (
                <>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-sm">☀️</span>
                    <h4 className="text-sm font-bold text-amber-300">第{selectedRound}轮 · 白天</h4>
                  </div>
                  <div className="ml-6 space-y-1.5">
                    <div className="text-xs text-gray-300">
                      🗳️ 投票结果: {roundEntry.exileVote.result === 'none' ? '无人出局' : roundEntry.exileVote.result === 'tie' ? '平票' : `${roundEntry.exileVote.result}号 被放逐`}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(roundEntry.exileVote.votes).map(([voterId, target]) => (
                        <span key={voterId} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">
                          {voterId}号→{target === 'skip' ? '弃票' : `${target}号`}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 操作日志 fallback */}
          {!roundEntry && filteredLogs.length > 0 && (
            <div className="space-y-1">
              {filteredLogs.map(log => (
                <div key={log.id} className="text-xs text-gray-400 py-1 border-b border-white/5">
                  <span className="text-gray-600">{getPhaseLabel(log.phase)}</span>
                  <span className="ml-2">{log.result}</span>
                </div>
              ))}
            </div>
          )}

          {!roundEntry && filteredLogs.length === 0 && (
            <div className="text-center text-gray-600 text-sm py-8">
              该回合暂无历史数据
            </div>
          )}
        </div>
      </div>
    </>
  );
}
