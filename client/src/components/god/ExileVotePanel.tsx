import { Game } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';

interface ExileVotePanelProps {
  currentGame: Game;
}

export default function ExileVotePanel({ currentGame }: ExileVotePanelProps) {
  return (
    <>
      {/* 上帝指定警长UI - 狼人自爆场景 */}
      {currentGame.pendingSheriffTransfer?.reason === 'wolf_explosion' && (
        <div className="bg-red-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-red-500">
          <h4 className="text-xl font-bold text-red-400 mb-4">
            白狼王自爆 - 请指定警徽归属
          </h4>
          <p className="text-gray-300 mb-4">
            警长 {currentGame.pendingSheriffTransfer.fromPlayerId}号 (白狼王) 自爆，请指定警徽给谁
          </p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {currentGame.pendingSheriffTransfer.options.map(playerId => {
              const player = currentGame.players.find(p => p.playerId === playerId);
              return (
                <button
                  key={playerId}
                  onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: playerId })}
                  className="p-3 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500 rounded-lg transition"
                >
                  <div className="text-white font-bold">{playerId}号</div>
                  <div className="text-gray-300 text-xs">{player?.username}</div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: 'none' })}
            className="w-full py-3 bg-gray-600/30 hover:bg-gray-600/50 border border-gray-500 text-gray-300 rounded-lg transition"
          >
            不给警徽
          </button>
        </div>
      )}

      {/* 放逐投票控制面板 */}
      {currentGame.exileVote && currentGame.exileVote.phase !== 'done' && (
        <div className="bg-orange-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-orange-500">
          <h4 className="text-xl font-bold text-orange-400 mb-4">
            放逐投票 - {
              currentGame.exileVote.phase === 'voting' ? '投票阶段' :
              currentGame.exileVote.phase === 'pk' ? '平票PK阶段' : '进行中'
            }
          </h4>

          {/* 显示投票情况 */}
          {Object.keys(currentGame.exileVote.votes).length > 0 && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                已投票 ({Object.keys(currentGame.exileVote.votes).length}人):
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(currentGame.exileVote.votes).map(([voterId, targetId]) => (
                  <div key={voterId} className="text-gray-300 bg-white/5 p-2 rounded">
                    {voterId}号 → {targetId === 'skip' ? '弃票' : `${targetId}号`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 投票统计 */}
          {Object.keys(currentGame.exileVote.votes).length > 0 && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">票数统计:</div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const voteCount: { [target: string]: number } = {};
                  Object.values(currentGame.exileVote!.votes).forEach(targetId => {
                    if (targetId !== 'skip') {
                      const key = String(targetId);
                      voteCount[key] = (voteCount[key] || 0) + 1;
                    }
                  });
                  return Object.entries(voteCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([targetId, count]) => (
                      <span key={targetId} className="px-3 py-1 bg-orange-600/30 border border-orange-500/50 rounded-full text-white text-sm">
                        {targetId}号: {count}票
                      </span>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* 平票PK玩家 */}
          {currentGame.exileVote.phase === 'pk' && currentGame.exileVote.pkPlayers && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                平票PK玩家:
              </div>
              <div className="flex flex-wrap gap-2">
                {currentGame.exileVote.pkPlayers.map(playerId => (
                  <span key={playerId} className="px-3 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-white text-sm">
                    {playerId}号
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
