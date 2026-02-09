import { Game } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';

interface SheriffElectionPanelProps {
  currentGame: Game;
}

export default function SheriffElectionPanel({ currentGame }: SheriffElectionPanelProps) {
  return (
    <>
      {/* 警长竞选控制面板 */}
      {currentGame.sheriffElection && currentGame.sheriffElection.phase !== 'done' && currentGame.sheriffElection.phase !== 'tie' && (
        <div className="bg-yellow-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-yellow-500">
          <h4 className="text-xl font-bold text-yellow-400 mb-4">
            警长竞选 - {
              currentGame.sheriffElection.phase === 'signup' ? '上警阶段' :
              currentGame.sheriffElection.phase === 'campaign' ? '发言阶段' :
              currentGame.sheriffElection.phase === 'voting' ? '投票阶段' : '进行中'
            }
          </h4>

          {/* 显示当前上警的玩家 */}
          <div className="mb-4">
            <div className="text-gray-300 text-sm mb-2">
              上警玩家 ({currentGame.sheriffElection.candidates.length}人):
            </div>
            <div className="flex flex-wrap gap-2">
              {currentGame.sheriffElection.candidates.length > 0 ? (
                currentGame.sheriffElection.candidates.map(playerId => {
                  const player = currentGame.players.find(p => p.playerId === playerId);
                  return (
                    <span key={playerId} className="px-3 py-1 bg-yellow-600/30 border border-yellow-500/50 rounded-full text-white text-sm">
                      {playerId}号 {player?.username}
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-400 text-sm">暂无人上警</span>
              )}
            </div>
          </div>

          {/* 显示退水的玩家 */}
          {currentGame.sheriffElection.withdrawn.length > 0 && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                已退水 ({currentGame.sheriffElection.withdrawn.length}人):
              </div>
              <div className="flex flex-wrap gap-2">
                {currentGame.sheriffElection.withdrawn.map(playerId => (
                  <span key={playerId} className="px-3 py-1 bg-gray-600/30 border border-gray-500/50 rounded-full text-gray-400 text-sm line-through">
                    {playerId}号
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 投票阶段显示投票情况 */}
          {currentGame.sheriffElection.phase === 'voting' && Object.keys(currentGame.sheriffElection.votes).length > 0 && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                已投票 ({Object.keys(currentGame.sheriffElection.votes).length}人):
              </div>
              <div className="space-y-1 text-sm">
                {Object.entries(currentGame.sheriffElection.votes).map(([voterId, candidateId]) => (
                  <div key={voterId} className="text-gray-300">
                    {voterId}号 → {candidateId === 'skip' ? '弃票' : `${candidateId}号`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 阶段控制按钮 */}
          <div className="flex gap-3">
            {currentGame.sheriffElection.phase === 'signup' && (
              <button
                onClick={() => wsService.send({ type: 'GOD_SHERIFF_START_CAMPAIGN' })}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition"
              >
                结束上警，进入发言
              </button>
            )}
            {currentGame.sheriffElection.phase === 'campaign' && (
              <button
                onClick={() => wsService.send({ type: 'GOD_SHERIFF_START_VOTING' })}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition"
              >
                结束发言，进入投票
              </button>
            )}
            {currentGame.sheriffElection.phase === 'voting' && (
              <button
                onClick={() => wsService.send({ type: 'GOD_SHERIFF_TALLY_VOTES' })}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition"
              >
                结束投票，统计结果
              </button>
            )}
          </div>
        </div>
      )}

      {/* 上帝指定警长UI - 平票场景 */}
      {currentGame.sheriffElection?.phase === 'tie' && currentGame.sheriffElection.tiedPlayers && (
        <div className="bg-yellow-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-yellow-500">
          <h4 className="text-xl font-bold text-yellow-400 mb-4">
            警长竞选平票 - 请指定警长
          </h4>
          <p className="text-gray-300 mb-4">
            平票玩家: {currentGame.sheriffElection.tiedPlayers.map(id => `${id}号`).join(', ')}
          </p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {currentGame.sheriffElection.tiedPlayers.map(playerId => {
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
            警徽流失（不给警徽）
          </button>
        </div>
      )}
    </>
  );
}
