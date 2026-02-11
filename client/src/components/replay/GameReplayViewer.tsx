import { useRef, useState } from 'react';
import { X, Download, Image } from 'lucide-react';
import {
  GameReplayData,
  RoundReplayData,
  NightActionReplayRecord,
  DeathReplayInfo,
  SpecialReplayEvent,
} from '../../../../shared/src/types';
import { useToast } from '../Toast';

interface GameReplayViewerProps {
  isOpen: boolean;
  onClose: () => void;
  replayData: GameReplayData | null;
}

/**
 * 按目标聚合投票明细
 * 格式: 5号←1,3,7号 / 2号←4,8号 / 弃票←6号
 */
function aggregateReplayVotes(
  votes: { voterId: number; targetId: number | 'skip' }[]
): string {
  const targetToVoters = new Map<string, number[]>();
  for (const v of votes) {
    const key = v.targetId === 'skip' ? 'skip' : String(v.targetId);
    if (!targetToVoters.has(key)) targetToVoters.set(key, []);
    targetToVoters.get(key)!.push(v.voterId);
  }
  if (targetToVoters.size === 0) return '';

  const entries = [...targetToVoters.entries()].sort((a, b) => {
    if (a[0] === 'skip') return 1;
    if (b[0] === 'skip') return -1;
    return b[1].length - a[1].length;
  });

  return entries.map(([target, voters]) => {
    const voterStr = voters.sort((a, b) => a - b).map(v => `${v}`).join(',');
    const label = target === 'skip' ? '弃票' : `${target}号`;
    return `${label}←${voterStr}号`;
  }).join(' / ');
}

/**
 * 角色emoji映射
 */
const getRoleEmoji = (role: string): string => {
  const emojiMap: { [key: string]: string } = {
    wolf: '🐺',
    white_wolf: '🐺',
    black_wolf: '🐺',
    wolf_beauty: '💋',
    seer: '🔮',
    witch: '🧪',
    guard: '🛡️',
    hunter: '🏹',
    villager: '👤',
    nightmare: '😱',
    dreamer: '💤',
    gravekeeper: '⚰️',
    gargoyle: '🗿',
    knight: '⚔️',
  };
  return emojiMap[role] || '❓';
};

/**
 * 夜间行动卡片组件
 */
function NightActionCard({ action }: { action: NightActionReplayRecord }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-900/50 rounded text-xs">
      <span>{getRoleEmoji(action.role)}</span>
      <span className="text-indigo-200">{action.action}</span>
      {action.target !== undefined && (
        <span className="text-white font-bold">{action.target}号</span>
      )}
      {action.result && (
        <span className="text-yellow-300">={action.result}</span>
      )}
    </div>
  );
}

/**
 * 死亡信息组件
 */
function DeathBadge({ death }: { death: DeathReplayInfo }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700/50 rounded text-xs">
      <span className="text-red-400">💀</span>
      <span className="text-gray-200">{death.playerId}号</span>
      <span className="text-gray-400">({death.roleName})</span>
      {death.causeText && <span className="text-gray-500">{death.causeText}</span>}
    </span>
  );
}

/**
 * 单回合卡片组件
 */
function RoundCard({ round, isLast }: { round: RoundReplayData; isLast: boolean }) {
  return (
    <div className="relative">
      {/* 回合卡片 */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
        {/* 回合标题 */}
        <div className="bg-gray-700 px-4 py-2 border-b border-gray-600">
          <span className="text-white font-bold">第 {round.round} 回合</span>
        </div>

        <div className="p-4 space-y-3">
          {/* 夜晚阶段 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <span className="text-indigo-300 font-semibold">夜晚</span>
            </div>

            {/* 夜间行动 */}
            {round.night.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-6">
                {round.night.actions.map((action, i) => (
                  <NightActionCard key={i} action={action} />
                ))}
              </div>
            )}

            {/* 结算信息 */}
            <div className="ml-6 flex items-center gap-2">
              <span className="text-gray-400 text-sm">📋</span>
              <span className="text-gray-300 text-sm">{round.night.settlement}</span>
            </div>

            {/* 夜间死亡 */}
            {round.night.deaths.length > 0 && (
              <div className="ml-6 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">出局:</span>
                {round.night.deaths.map((death, i) => (
                  <DeathBadge key={i} death={death} />
                ))}
              </div>
            )}
          </div>

          {/* 白天阶段 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <span className="text-amber-300 font-semibold">白天</span>
            </div>

            {/* 警长竞选 */}
            {round.day.sheriffElection && round.day.sheriffElection.result.winnerId && (
              <div className="ml-6 bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>🎖️</span>
                  <span className="text-yellow-200">
                    {round.day.sheriffElection.result.winnerId}号
                    {round.day.sheriffElection.result.winnerName &&
                      `(${round.day.sheriffElection.result.winnerName})`
                    }
                    当选警长
                  </span>
                </div>
                {round.day.sheriffElection.candidates.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    上警: {round.day.sheriffElection.candidates.map(c => `${c.playerId}号`).join(' ')}
                    {round.day.sheriffElection.withdrawn.length > 0 && (
                      <span className="ml-2">
                        退水: {round.day.sheriffElection.withdrawn.map(w => `${w.playerId}号`).join(' ')}
                      </span>
                    )}
                  </div>
                )}
                {round.day.sheriffElection.votes.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {aggregateReplayVotes(round.day.sheriffElection.votes)}
                  </div>
                )}
              </div>
            )}

            {/* 放逐投票 */}
            {round.day.exileVote && (
              <div className="ml-6 bg-red-900/30 border border-red-700/50 rounded px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span>🗳️</span>
                  {round.day.exileVote.result.exiledId ? (
                    <span className="text-red-200">
                      {round.day.exileVote.result.exiledId}号
                      {round.day.exileVote.result.exiledName &&
                        `(${round.day.exileVote.result.exiledName})`
                      }
                      被放逐
                    </span>
                  ) : round.day.exileVote.result.isTie ? (
                    <span className="text-gray-300">平票和平</span>
                  ) : (
                    <span className="text-gray-300">无人出局</span>
                  )}
                </div>
                {round.day.exileVote.votes.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {aggregateReplayVotes(round.day.exileVote.votes)}
                  </div>
                )}
              </div>
            )}

            {/* 特殊事件（自爆、猎人开枪、骑士决斗等） */}
            {round.day.specialEvents && round.day.specialEvents.length > 0 && (
              <div className="ml-6 space-y-1">
                {round.day.specialEvents.map((event, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/30 border border-orange-700/50 rounded text-sm">
                    <span>{event.icon}</span>
                    <span className="text-orange-200">{event.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 白天出局 */}
            {round.day.deaths.length > 0 && (
              <div className="ml-6 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">出局:</span>
                {round.day.deaths.map((death, i) => (
                  <DeathBadge key={i} death={death} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 连接线 */}
      {!isLast && (
        <div className="flex justify-center py-2">
          <div className="w-0.5 h-6 bg-gray-600"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2">
            <span className="text-gray-500">↓</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 游戏复盘可视化组件
 */
export default function GameReplayViewer({
  isOpen,
  onClose,
  replayData,
}: GameReplayViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();

  /**
   * 导出为PNG图片
   */
  const exportAsPNG = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    try {
      // 动态导入html2canvas
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2, // 高清导出
        useCORS: true,
        logging: false,
      });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `狼人杀复盘_${replayData?.meta.roomCode || 'game'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('导出图片失败:', error);
      toast('导出图片失败，请稍后重试', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!replayData) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 弹窗面板 */}
      <div
        className={`fixed inset-4 sm:inset-8 lg:inset-16 bg-gray-900 border border-white/20 rounded-xl z-50 flex flex-col transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <h2 className="text-xl font-bold text-white">游戏复盘</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAsPNG}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white text-sm transition"
            >
              <Image size={16} />
              {isExporting ? '导出中...' : '导出图片'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X className="text-white" size={24} />
            </button>
          </div>
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 可导出内容区域 */}
          <div
            ref={contentRef}
            className="max-w-3xl mx-auto p-6 bg-[#1a1a2e] rounded-lg"
          >
            {/* 游戏标题 */}
            <div className="text-center mb-6 pb-4 border-b border-gray-600">
              <h1 className="text-2xl font-bold text-white mb-2">
                狼人杀复盘
              </h1>
              <div className="text-gray-300 text-sm">
                房间 {replayData.meta.roomCode} | {replayData.meta.scriptName} | {replayData.meta.playerCount}人局
              </div>
              {replayData.meta.winner && (
                <div className={`inline-block mt-2 px-4 py-1 rounded-full text-sm font-bold ${
                  replayData.meta.winner === 'wolf'
                    ? 'bg-red-600/50 text-red-200'
                    : 'bg-green-600/50 text-green-200'
                }`}>
                  🏆 {replayData.meta.winner === 'wolf' ? '狼人阵营' : '好人阵营'}获胜
                </div>
              )}
              {replayData.meta.duration && (
                <div className="text-gray-500 text-xs mt-1">
                  游戏时长: {replayData.meta.duration}
                </div>
              )}
            </div>

            {/* 玩家列表 */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
              <div className="text-gray-300 text-sm font-semibold mb-2">玩家信息</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {replayData.players.map((player) => (
                  <span
                    key={player.playerId}
                    className={`px-2 py-1 rounded ${
                      player.camp === 'wolf'
                        ? 'bg-red-900/50 text-red-200'
                        : 'bg-blue-900/50 text-blue-200'
                    } ${player.deathRound ? 'opacity-50' : ''}`}
                  >
                    {player.playerId}号{player.username}
                    ({getRoleEmoji(player.role)}{player.roleName})
                    {player.isSheriff && '🎖️'}
                    {player.deathRound && (
                      <span className="ml-1 text-gray-400">
                        💀R{player.deathRound}{player.deathReason ? ` ${player.deathReason}` : ''}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* 回合时间线 */}
            <div className="space-y-4">
              {replayData.rounds.map((round, index) => (
                <RoundCard
                  key={round.round}
                  round={round}
                  isLast={index === replayData.rounds.length - 1}
                />
              ))}
            </div>

            {/* 游戏结束 */}
            {replayData.meta.winner && (
              <div className="mt-6 pt-4 border-t border-gray-600">
                <div className={`text-center p-4 rounded-lg ${
                  replayData.meta.winner === 'wolf'
                    ? 'bg-red-900/30 border border-red-700/50'
                    : 'bg-green-900/30 border border-green-700/50'
                }`}>
                  <div className="text-2xl mb-2">🏆</div>
                  <div className={`text-lg font-bold ${
                    replayData.meta.winner === 'wolf' ? 'text-red-200' : 'text-green-200'
                  }`}>
                    {replayData.meta.winner === 'wolf' ? '狼人阵营' : '好人阵营'}获胜
                  </div>
                  {/* 存活者按阵营分类 */}
                  {(() => {
                    const survivors = replayData.players.filter(p => !p.deathRound);
                    const wolfSurvivors = survivors.filter(p => p.camp === 'wolf');
                    const goodSurvivors = survivors.filter(p => p.camp !== 'wolf');
                    return (
                      <div className="mt-3 space-y-1.5 text-sm">
                        {goodSurvivors.length > 0 && (
                          <div className="text-blue-300">
                            <span className="text-gray-400">好人存活: </span>
                            {goodSurvivors.map(p => `${p.playerId}号(${p.roleName})`).join(' ')}
                          </div>
                        )}
                        {wolfSurvivors.length > 0 && (
                          <div className="text-red-300">
                            <span className="text-gray-400">狼人存活: </span>
                            {wolfSurvivors.map(p => `${p.playerId}号(${p.roleName})`).join(' ')}
                          </div>
                        )}
                        {survivors.length === 0 && (
                          <div className="text-gray-400">无人存活</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 水印 */}
            <div className="text-center text-gray-600 text-xs mt-4">
              狼人杀在线 | werewolf-app
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
