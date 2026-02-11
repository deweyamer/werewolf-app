import { Game, SheriffElectionState } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';

interface SheriffElectionPanelProps {
  currentGame: Game;
}

/**
 * 按候选人聚合投票明细
 * 输出格式: { candidateId => [voterId, ...], 'skip' => [voterId, ...] }
 */
function groupVotesByCandidate(votes: SheriffElectionState['votes']) {
  const groups: Map<number | 'skip', number[]> = new Map();
  Object.entries(votes).forEach(([voterId, candidateId]) => {
    const key = candidateId === 'skip' ? 'skip' : candidateId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(Number(voterId));
  });
  return groups;
}

/**
 * 渲染按候选人聚合的投票明细
 */
function VoteDetailGrouped({ election, players }: {
  election: SheriffElectionState;
  players: Game['players'];
}) {
  const hasVotes = Object.keys(election.votes).length > 0;
  if (!hasVotes) return null;

  const groups = groupVotesByCandidate(election.votes);

  return (
    <div className="pt-2 border-t border-white/10 space-y-2">
      <div className="text-gray-400 text-xs mb-1">投票明细:</div>
      {election.candidates.map(candidateId => {
        const candidate = players.find(p => p.playerId === candidateId);
        const voterIds = groups.get(candidateId) || [];
        if (voterIds.length === 0) return null;
        return (
          <div key={candidateId} className="text-xs">
            <span className="text-white font-bold">{candidateId}号 {candidate?.username}</span>
            <span className="text-gray-500 mx-1">←</span>
            <span className="text-gray-400">
              {voterIds.map(id => `${id}号`).join('、')}
            </span>
          </div>
        );
      })}
      {(() => {
        const skipVoters = groups.get('skip') || [];
        return skipVoters.length > 0 ? (
          <div className="text-xs">
            <span className="text-gray-500 font-bold">弃票</span>
            <span className="text-gray-500 mx-1">←</span>
            <span className="text-gray-500">
              {skipVoters.map(id => `${id}号`).join('、')}
            </span>
          </div>
        ) : null;
      })()}
    </div>
  );
}

export default function SheriffElectionPanel({ currentGame }: SheriffElectionPanelProps) {
  return (
    <>
      {/* 警长竞选控制面板 */}
      {currentGame.sheriffElection && currentGame.sheriffElection.phase !== 'tie' && (
        <div className="bg-yellow-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-yellow-500">
          <h4 className="text-xl font-bold text-yellow-400 mb-4">
            警长竞选 - {
              currentGame.sheriffElection.phase === 'signup' ? '上警阶段' :
              currentGame.sheriffElection.phase === 'campaign' ? '发言阶段' :
              currentGame.sheriffElection.phase === 'voting' ? '投票阶段' :
              currentGame.sheriffElection.phase === 'done' ? '投票结果' : '进行中'
            }
          </h4>

          {/* 上警阶段：展示每个玩家的上警状态 */}
          {currentGame.sheriffElection.phase === 'signup' && (
            <div className="mb-4">
              <div className="text-gray-300 text-sm mb-2">
                上警情况 ({currentGame.players.filter(p => p.alive && p.sheriffCandidate !== undefined).length} / {currentGame.players.filter(p => p.alive).length} 已选择):
              </div>
              <div className="space-y-1.5">
                {/* 已上警 */}
                {currentGame.sheriffElection.candidates.length > 0 && (
                  <div className="text-xs">
                    <span className="text-yellow-400 font-bold">上警:</span>
                    <span className="text-white ml-2">
                      {currentGame.sheriffElection.candidates.map(id => {
                        const p = currentGame.players.find(p => p.playerId === id);
                        return `${id}号${p?.username ? ' ' + p.username : ''}`;
                      }).join('、')}
                    </span>
                  </div>
                )}
                {/* 不上警 */}
                {(() => {
                  const notRunning = currentGame.players.filter(
                    p => p.alive && p.sheriffCandidate === false
                  );
                  return notRunning.length > 0 ? (
                    <div className="text-xs">
                      <span className="text-gray-500 font-bold">不上警:</span>
                      <span className="text-gray-400 ml-2">
                        {notRunning.map(p => `${p.playerId}号`).join('、')}
                      </span>
                    </div>
                  ) : null;
                })()}
                {/* 未选择 */}
                {(() => {
                  const pending = currentGame.players.filter(
                    p => p.alive && p.sheriffCandidate === undefined
                  );
                  return pending.length > 0 ? (
                    <div className="text-xs">
                      <span className="text-orange-400 font-bold">未选择:</span>
                      <span className="text-orange-300 ml-2">
                        {pending.map(p => `${p.playerId}号`).join('、')}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* 发言/竞选阶段：显示上警和退水的玩家 */}
          {currentGame.sheriffElection.phase === 'campaign' && (
            <>
              <div className="mb-4">
                <div className="text-gray-300 text-sm mb-2">
                  候选人 ({currentGame.sheriffElection.candidates.length}人):
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentGame.sheriffElection.candidates.map(playerId => {
                    const player = currentGame.players.find(p => p.playerId === playerId);
                    return (
                      <span key={playerId} className="px-3 py-1 bg-yellow-600/30 border border-yellow-500/50 rounded-full text-white text-sm">
                        {playerId}号 {player?.username}
                      </span>
                    );
                  })}
                </div>
              </div>
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
            </>
          )}

          {/* 投票阶段显示投票详情 */}
          {currentGame.sheriffElection.phase === 'voting' && (() => {
            const election = currentGame.sheriffElection!;
            const eligibleVoters = currentGame.players.filter(
              p => p.alive && !election.candidates.includes(p.playerId) && !election.withdrawn.includes(p.playerId)
            );
            const votedCount = Object.keys(election.votes).length;
            const totalVoters = eligibleVoters.length;

            return (
              <div className="mb-4 space-y-3">
                {/* 投票进度 */}
                <div className="text-gray-300 text-sm">
                  投票进度: {votedCount} / {totalVoters}
                  {votedCount === totalVoters && (
                    <span className="ml-2 text-green-400 font-bold">投票完成，正在自动计票...</span>
                  )}
                </div>

                {/* 各候选人得票统计 */}
                {votedCount > 0 && (
                  <div className="space-y-1.5">
                    {election.candidates.map(candidateId => {
                      const voteCount = Object.values(election.votes).filter(v => v === candidateId).length;
                      const candidate = currentGame.players.find(p => p.playerId === candidateId);
                      return (
                        <div key={candidateId} className="flex items-center justify-between text-sm">
                          <span className="text-white">{candidateId}号 {candidate?.username}</span>
                          <span className="text-yellow-400 font-bold">{voteCount} 票</span>
                        </div>
                      );
                    })}
                    {(() => {
                      const skipCount = Object.values(election.votes).filter(v => v === 'skip').length;
                      return skipCount > 0 ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">弃票</span>
                          <span className="text-gray-400 font-bold">{skipCount} 票</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* 聚合投票明细 */}
                {votedCount > 0 && (
                  <VoteDetailGrouped election={election} players={currentGame.players} />
                )}
              </div>
            );
          })()}

          {/* 投票结果展示（done 阶段） */}
          {currentGame.sheriffElection.phase === 'done' && (() => {
            const election = currentGame.sheriffElection!;
            const hasVotes = Object.keys(election.votes).length > 0;

            return (
              <div className="space-y-4">
                {/* 当选结果 */}
                <div className="text-center py-3">
                  {election.result ? (
                    <div>
                      <span className="text-yellow-400 text-2xl font-bold">
                        {election.result}号
                      </span>
                      <span className="text-white text-lg ml-2">
                        {currentGame.players.find(p => p.playerId === election.result)?.username}
                      </span>
                      <div className="text-yellow-300 mt-1">当选警长</div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-lg">无人当选警长</div>
                  )}
                </div>

                {/* 加权计票结果 + 聚合明细 */}
                {hasVotes && election.voteTally && (
                  <div className="space-y-2">
                    <div className="text-gray-300 text-sm font-bold">计票结果 (含权重):</div>
                    {election.candidates.map(candidateId => {
                      const candidate = currentGame.players.find(p => p.playerId === candidateId);
                      const weightedVotes = election.voteTally?.[candidateId] || 0;
                      return (
                        <div key={candidateId} className="flex items-center justify-between text-sm">
                          <span className={`${candidateId === election.result ? 'text-yellow-400 font-bold' : 'text-white'}`}>
                            {candidateId}号 {candidate?.username}
                          </span>
                          <span className={`font-bold ${candidateId === election.result ? 'text-yellow-400' : 'text-gray-300'}`}>
                            {weightedVotes} 票
                          </span>
                        </div>
                      );
                    })}
                    {(() => {
                      const skipCount = Object.values(election.votes).filter(v => v === 'skip').length;
                      return skipCount > 0 ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">弃票</span>
                          <span className="text-gray-400 font-bold">{skipCount} 人</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* 聚合投票明细 */}
                {hasVotes && (
                  <VoteDetailGrouped election={election} players={currentGame.players} />
                )}
              </div>
            );
          })()}

          {/* 阶段控制按钮 */}
          {currentGame.sheriffElection.phase !== 'done' && (
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
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition text-sm"
                >
                  手动统计结果（全部投完后自动统计）
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 上帝指定警长UI - 平票场景 */}
      {currentGame.sheriffElection?.phase === 'tie' && currentGame.sheriffElection.tiedPlayers && (
        <div className="bg-yellow-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-yellow-500">
          <h4 className="text-xl font-bold text-yellow-400 mb-4">
            警长竞选平票 - 请指定警长
          </h4>

          {/* 平票时也展示投票结果 */}
          {currentGame.sheriffElection.voteTally && (
            <div className="mb-4 space-y-2">
              <div className="text-gray-300 text-sm font-bold">计票结果 (含权重):</div>
              {currentGame.sheriffElection.candidates.map(candidateId => {
                const candidate = currentGame.players.find(p => p.playerId === candidateId);
                const weightedVotes = currentGame.sheriffElection?.voteTally?.[candidateId] || 0;
                const isTied = currentGame.sheriffElection?.tiedPlayers?.includes(candidateId);
                return (
                  <div key={candidateId} className="flex items-center justify-between text-sm">
                    <span className={`${isTied ? 'text-yellow-400 font-bold' : 'text-white'}`}>
                      {candidateId}号 {candidate?.username} {isTied ? '(平票)' : ''}
                    </span>
                    <span className={`font-bold ${isTied ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {weightedVotes} 票
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 聚合投票明细 */}
          {Object.keys(currentGame.sheriffElection.votes).length > 0 && (
            <div className="mb-4">
              <VoteDetailGrouped election={currentGame.sheriffElection} players={currentGame.players} />
            </div>
          )}

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
