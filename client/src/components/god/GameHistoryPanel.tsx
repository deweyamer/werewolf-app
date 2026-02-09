import { Game } from '../../../../shared/src/types';
import { getPhaseLabel } from '../../utils/phaseLabels';

interface GameHistoryPanelProps {
  currentGame: Game;
  expandedRounds: Set<number>;
  toggleRound: (round: number) => void;
}

export default function GameHistoryPanel({ currentGame, expandedRounds, toggleRound }: GameHistoryPanelProps) {
  // 按回合和阶段分组历史记录
  const groupHistoryByRounds = () => {
    const rounds: { [key: number]: any[] } = {};
    currentGame.history.forEach(log => {
      if (!rounds[log.round]) {
        rounds[log.round] = [];
      }
      rounds[log.round].push(log);
    });

    return Object.entries(rounds).map(([round, logs]) => ({
      round: Number(round),
      logs,
    })).sort((a, b) => b.round - a.round); // 最新的在前
  };

  return (
    <>
      {/* 历史回合摘要（显示已结算回合的夜晚/白天操作） */}
      {currentGame.roundHistory && currentGame.roundHistory.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
          <h4 className="text-xl font-bold text-white mb-4">历史回合摘要</h4>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {currentGame.roundHistory.map((entry) => (
              <div key={entry.round} className="border border-white/20 rounded-lg p-4 bg-white/5">
                <div className="text-lg font-bold text-blue-400 mb-3">第 {entry.round} 回合</div>

                {/* 夜晚操作 */}
                <div className="mb-3">
                  <div className="text-gray-400 text-sm mb-2">夜晚操作:</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {entry.nightActions.wolfKill !== undefined && (
                      <div className="text-red-300 bg-red-600/10 p-2 rounded">
                        狼刀: {entry.nightActions.wolfKill}号
                      </div>
                    )}
                    {entry.nightActions.guardTarget !== undefined && (
                      <div className="text-blue-300 bg-blue-600/10 p-2 rounded">
                        守卫守护: {entry.nightActions.guardTarget}号
                      </div>
                    )}
                    {entry.nightActions.seerCheck !== undefined && (
                      <div className="text-cyan-300 bg-cyan-600/10 p-2 rounded">
                        预言家查验: {entry.nightActions.seerCheck}号 ({entry.nightActions.seerResult === 'wolf' ? '狼人' : '好人'})
                      </div>
                    )}
                    {entry.nightActions.witchAction && entry.nightActions.witchAction !== 'none' && (
                      <div className="text-green-300 bg-green-600/10 p-2 rounded">
                        女巫: {entry.nightActions.witchAction === 'save' ? '使用解药' : `毒死${entry.nightActions.witchTarget}号`}
                      </div>
                    )}
                    {entry.nightActions.fear !== undefined && (
                      <div className="text-purple-300 bg-purple-600/10 p-2 rounded">
                        恐惧: {entry.nightActions.fear}号
                      </div>
                    )}
                    {entry.nightActions.dream !== undefined && (
                      <div className="text-blue-300 bg-blue-600/10 p-2 rounded">
                        摄梦: {entry.nightActions.dream}号
                      </div>
                    )}
                  </div>
                </div>

                {/* 放逐投票结果 */}
                {entry.exileVote && (
                  <div className="mb-3">
                    <div className="text-gray-400 text-sm mb-2">放逐投票:</div>
                    <div className="text-sm">
                      {entry.exileVote.result === 'none' ? (
                        <span className="text-gray-400">无人出局</span>
                      ) : entry.exileVote.result === 'tie' ? (
                        <span className="text-yellow-400">平票</span>
                      ) : (
                        <span className="text-orange-300">{entry.exileVote.result}号 被放逐</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {Object.entries(entry.exileVote.votes).map(([voterId, target]) => (
                        <span key={voterId} className="mr-2">
                          {voterId}号→{target === 'skip' ? '弃票' : `${target}号`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 死亡信息 */}
                {entry.deaths.length > 0 && (
                  <div className="text-red-400 text-sm">
                    死亡: {entry.deaths.map((id: number) => `${id}号`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作历史（按回合分组） */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
        <h4 className="text-xl font-bold text-white mb-4">游戏流程历史</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {groupHistoryByRounds().map(({ round, logs }) => (
            <div key={round} className="border border-white/20 rounded-lg overflow-hidden">
              {/* 回合标题 */}
              <button
                onClick={() => toggleRound(round)}
                className="w-full flex justify-between items-center p-3 bg-blue-600/20 hover:bg-blue-600/30 transition"
              >
                <span className="text-white font-bold">
                  {round === 0 ? '游戏准备' : `第 ${round} 回合`}
                </span>
                <span className="text-gray-300 text-sm">
                  {expandedRounds.has(round) ? '▼' : '▶'} {logs.length} 条记录
                </span>
              </button>

              {/* 回合详情 */}
              {expandedRounds.has(round) && (
                <div className="p-3 bg-white/5 space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="text-sm p-2 bg-white/10 rounded border-l-4 border-blue-500"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-blue-300 font-medium">
                          {getPhaseLabel(log.phase)}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                      <div className="text-gray-200">{log.result}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {currentGame.history.length === 0 && (
            <div className="text-gray-400 text-center py-4">暂无历史记录</div>
          )}
        </div>
      </div>
    </>
  );
}
