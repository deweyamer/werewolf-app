import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage, GamePlayer } from '../../../shared/src/types';
import { useToast } from '../components/Toast';
import { getRoleName, getPhaseLabel } from '../utils/phaseLabels';
import { useGameSocket } from '../hooks/useGameSocket';
import RoleActionPanel from '../components/RoleActionPanel';

export default function PlayerView() {
  const { user, clearAuth } = useAuthStore();
  const { currentGame, clearGame } = useGameStore();
  const toast = useToast();
  const [roomCode, setRoomCode] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(0);
  const [myPlayer, setMyPlayer] = useState<GamePlayer | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 女巫专用状态
  const [witchAction, setWitchAction] = useState<'none' | 'antidote' | 'poison'>('none');
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [poisonTarget, setPoisonTarget] = useState<number>(0);

  // 投票相关状态
  const [sheriffVote, setSheriffVote] = useState<number | 'skip'>(0);
  const [exileVote, setExileVote] = useState<number | 'skip'>(0);

  // 页面特定消息处理（通用消息由 useGameSocket 统一处理）
  const handlePageMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'ROLE_ASSIGNED':
        toast(`你的角色是: ${getRoleName(message.role)} (${message.camp === 'wolf' ? '狼人阵营' : '好人阵营'})`, 'info', 5000);
        break;
      case 'PHASE_CHANGED':
        setIsSubmitting(false);
        toast(`${getPhaseLabel(message.phase)}`, 'info');
        break;
      case 'GAME_FINISHED':
        toast(`游戏结束！${message.winner === 'wolf' ? '狼人' : '好人'}获胜！`, 'info', 8000);
        break;
      case 'ACTION_RESULT':
        setIsSubmitting(false);
        if (message.success) {
          if (message.data?.seerResult) {
            const seerInfo = message.data.seerResult;
            toast(`查验结果：${seerInfo.message}`, 'info', 6000);
          } else if (message.data?.gravekeeperResult) {
            const gkInfo = message.data.gravekeeperResult;
            toast(`验尸结果：${gkInfo.message}`, 'info', 6000);
          } else if (message.data?.victimInfo) {
            // 女巫的被刀信息在UI中显示，不需要toast
          } else {
            toast('操作成功', 'success');
          }
          setSelectedTarget(0);
          setWitchAction('none');
          setPoisonTarget(0);
          setShowPoisonModal(false);
        } else {
          toast(message.message, 'error');
        }
        break;
    }
  }, [toast]);

  useGameSocket(handlePageMessage);

  useEffect(() => {
    if (currentGame && user) {
      const player = currentGame.players.find((p) => p.userId === user.userId);
      setMyPlayer(player || null);
    }
  }, [currentGame, user]);

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast('请输入房间码', 'warning');
      return;
    }
    wsService.send({
      type: 'JOIN_ROOM',
      roomCode: roomCode.trim().toUpperCase(),
      playerId: selectedPlayerId > 0 ? selectedPlayerId : undefined
    });
  };

  const handleLeaveRoom = () => {
    if (confirm('确定离开房间吗？')) {
      wsService.send({ type: 'LEAVE_ROOM' });
      wsService.clearRoomCode();
      clearGame();
      setMyPlayer(null);
    }
  };

  const handleSubmitAction = () => {
    if (!myPlayer || !currentGame || isSubmitting) return;
    setIsSubmitting(true);

    const action = {
      phase: currentGame.currentPhase,
      playerId: myPlayer.playerId,
      actionType: 'action',
      target: selectedTarget,
    };

    wsService.send({ type: 'PLAYER_SUBMIT_ACTION', action });
  };

  // 女巫提交操作
  const handleWitchSubmit = (
    actionOverride?: 'save' | 'poison' | 'none',
    targetOverride?: number
  ) => {
    if (!myPlayer || !currentGame || isSubmitting) return;
    setIsSubmitting(true);

    const actionType = actionOverride ?? 'none';
    const target = targetOverride ?? (actionType === 'save'
      ? (currentGame.nightActions.witchKnowsVictim || 0)
      : 0);

    wsService.send({
      type: 'PLAYER_SUBMIT_ACTION',
      action: {
        phase: currentGame.currentPhase,
        playerId: myPlayer.playerId,
        actionType,
        target,
      },
    });

    setWitchAction('none');
    setPoisonTarget(0);
    setShowPoisonModal(false);
  };

  // 警长竞选:上警或不上警
  const handleSheriffSignup = (runForSheriff: boolean) => {
    wsService.send({ type: 'SHERIFF_SIGNUP', runForSheriff });
  };

  // 警长竞选:退水
  const handleSheriffWithdraw = () => {
    if (confirm('确定要退水吗?')) {
      wsService.send({ type: 'SHERIFF_WITHDRAW' });
    }
  };

  // 格式化投票目标用于确认提示
  const formatVoteTarget = (target: number | 'skip') => {
    if (target === 'skip') return '弃票';
    const player = currentGame?.players.find(p => p.playerId === target);
    return player ? `${target}号 ${player.username}` : `${target}号`;
  };

  // 警长竞选:投票
  const handleSheriffVote = () => {
    if (sheriffVote === 0) {
      toast('请选择要投票的候选人,或选择弃票', 'warning');
      return;
    }
    if (isSubmitting) return;
    if (!confirm(`确认投票给 ${formatVoteTarget(sheriffVote)} ？投票后不可更改。`)) return;
    setIsSubmitting(true);
    wsService.send({ type: 'SHERIFF_VOTE', candidateId: sheriffVote });
    setSheriffVote(0);
  };

  // 放逐投票
  const handleExileVote = () => {
    if (exileVote === 0) {
      toast('请选择要投票的玩家,或选择弃票', 'warning');
      return;
    }
    if (isSubmitting) return;
    if (!confirm(`确认投票放逐 ${formatVoteTarget(exileVote)} ？投票后不可更改。`)) return;
    setIsSubmitting(true);
    wsService.send({ type: 'EXILE_VOTE', targetId: exileVote });
    setExileVote(0);
  };

  // 平票PK投票
  const handleExilePKVote = () => {
    if (exileVote === 0) {
      toast('请选择要投票的玩家,或选择弃票', 'warning');
      return;
    }
    if (isSubmitting) return;
    if (!confirm(`确认投票放逐 ${formatVoteTarget(exileVote)} ？投票后不可更改。`)) return;
    setIsSubmitting(true);
    wsService.send({ type: 'EXILE_PK_VOTE', targetId: exileVote });
    setExileVote(0);
  };

  const handleLogout = () => {
    wsService.disconnect();
    clearAuth();
    clearGame();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">玩家视图</h1>
            <p className="text-gray-300">欢迎, {user?.username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            退出登录
          </button>
        </div>

        {!currentGame ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">加入房间</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">房间码</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white uppercase"
                  placeholder="输入6位房间码"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  选择号位 <span className="text-gray-400">(可选，点击选择或留空自动分配)</span>
                </label>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(seatId => (
                    <button
                      key={seatId}
                      onClick={() => setSelectedPlayerId(selectedPlayerId === seatId ? 0 : seatId)}
                      className={`p-2 rounded-lg text-sm font-bold transition border ${
                        selectedPlayerId === seatId
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {seatId}号
                    </button>
                  ))}
                </div>
                <p className="text-gray-400 text-xs">
                  {selectedPlayerId > 0
                    ? `已选择 ${selectedPlayerId}号位，如果被占用则加入失败`
                    : '未选择号位，将自动分配空闲位置'
                  }
                </p>
              </div>
              <button
                onClick={handleJoinRoom}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
              >
                加入房间
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">房间: {currentGame.roomCode}</h2>
                  <p className="text-gray-300">{currentGame.scriptName}</p>
                </div>
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  离开房间
                </button>
              </div>

              {myPlayer && (
                <div className="mb-6 p-4 bg-blue-600/20 border-2 border-blue-500 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-white font-bold text-lg">
                      你是 {myPlayer.playerId}号
                    </div>
                    {myPlayer.isSheriff && (
                      <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm font-bold">
                        警长 (1.5票)
                      </span>
                    )}
                  </div>
                  {myPlayer.role && (
                    <div className="text-gray-300">
                      角色: {getRoleName(myPlayer.role)} | 阵营: {myPlayer.camp === 'wolf' ? '狼人' : '好人'}
                    </div>
                  )}
                  {!myPlayer.alive && (
                    <div className="text-red-400 mt-2">你已出局</div>
                  )}
                </div>
              )}

              {/* 警长信息显示 */}
              {currentGame.sheriffId > 0 && (
                <div className="mb-6 p-4 bg-yellow-600/20 border border-yellow-500 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">当前警长:</span>
                    <span className="text-white font-bold">{currentGame.sheriffId}号</span>
                    <span className="text-gray-300 text-sm">
                      ({currentGame.players.find(p => p.playerId === currentGame.sheriffId)?.username})
                    </span>
                    {currentGame.sheriffId === myPlayer?.playerId && (
                      <span className="text-yellow-400 text-sm ml-2">(你)</span>
                    )}
                  </div>
                </div>
              )}
              {currentGame.sheriffBadgeState === 'destroyed' && (
                <div className="mb-6 p-4 bg-gray-600/20 border border-gray-500 rounded-lg">
                  <span className="text-gray-400">警徽已流失</span>
                </div>
              )}

              {/* 警徽传递UI - 警长死亡后 */}
              {currentGame.pendingSheriffTransfer?.fromPlayerId === myPlayer?.playerId &&
               currentGame.pendingSheriffTransfer?.reason === 'death' && (
                <div className="mb-6 bg-yellow-600/20 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-yellow-500">
                  <h3 className="text-xl font-bold text-yellow-400 mb-4">
                    警徽传递
                  </h3>
                  <p className="text-gray-300 mb-4">
                    你已出局，请选择传递警徽给谁或撕毁警徽
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {currentGame.pendingSheriffTransfer.options.map(playerId => {
                      const player = currentGame.players.find(p => p.playerId === playerId);
                      return (
                        <button
                          key={playerId}
                          onClick={() => wsService.send({ type: 'SHERIFF_TRANSFER', targetId: playerId })}
                          className="p-4 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500 rounded-lg transition"
                        >
                          <div className="text-white font-bold">{playerId}号</div>
                          <div className="text-gray-300 text-sm">{player?.username}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => wsService.send({ type: 'SHERIFF_TRANSFER', targetId: 'destroy' })}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
                  >
                    撕毁警徽
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white mb-4">
                  玩家列表 ({currentGame.players.length}/12)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {currentGame.players.map((player) => (
                    <div
                      key={player.playerId}
                      className={`p-4 rounded-lg border-2 ${
                        player.userId === user?.userId
                          ? 'bg-blue-600/20 border-blue-500'
                          : player.alive
                            ? 'bg-green-600/20 border-green-500'
                            : 'bg-red-600/20 border-red-500'
                      }`}
                    >
                      <div className="text-white font-bold">
                        {player.playerId}号 {player.isSheriff && '🎖️'}
                      </div>
                      <div className="text-gray-300 text-sm">{player.username}</div>
                      {!player.alive && (
                        // ⚠️ 安全警告: 禁止显示 outReason (player.outReason)
                        // 显示出局原因会泄露关键游戏信息 (如"被狼刀"泄露狼人行为)
                        <div className="text-red-400 text-sm mt-1">已出局</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {currentGame.status === 'running' && myPlayer?.alive && (
              <RoleActionPanel
                myPlayer={myPlayer}
                currentGame={currentGame}
                selectedTarget={selectedTarget}
                setSelectedTarget={setSelectedTarget}
                witchAction={witchAction}
                setWitchAction={setWitchAction}
                showPoisonModal={showPoisonModal}
                setShowPoisonModal={setShowPoisonModal}
                poisonTarget={poisonTarget}
                setPoisonTarget={setPoisonTarget}
                onSubmitAction={handleSubmitAction}
                onWitchSubmit={handleWitchSubmit}
                isSubmitting={isSubmitting}
              />
            )}

            {/* 出局玩家观战模式 */}
            {currentGame.status === 'running' && myPlayer && !myPlayer.alive && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">👻</div>
                  <h3 className="text-2xl font-bold text-gray-400">观战模式</h3>
                  <p className="text-gray-500 mt-2">你已出局，正在观战中</p>
                </div>

                {/* 当前阶段信息 */}
                <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">当前阶段</div>
                  <div className="text-white font-bold text-lg">
                    第 {currentGame.currentRound} 回合 - {getPhaseLabel(currentGame.currentPhase)}
                  </div>
                </div>

                {/* 存活玩家列表 */}
                <div className="mb-6">
                  <h4 className="text-white font-bold mb-3">
                    存活玩家 ({currentGame.players.filter(p => p.alive).length}/{currentGame.players.length})
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {currentGame.players.map((p) => (
                      <div
                        key={p.playerId}
                        className={`p-2 rounded-lg text-center text-sm ${
                          p.alive
                            ? 'bg-green-600/20 border border-green-500/50 text-white'
                            : 'bg-gray-600/20 border border-gray-500/30 text-gray-500 line-through'
                        }`}
                      >
                        <div className="font-bold">{p.playerId}号</div>
                        <div className="text-xs truncate">{p.username}</div>
                        {p.isSheriff && <div className="text-yellow-400 text-xs">警长</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 你的角色信息回顾 */}
                <div className="p-4 bg-gray-600/20 border border-gray-500/30 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">你的身份</div>
                  <div className="text-gray-300">
                    {myPlayer.playerId}号 - {getRoleName(myPlayer.role)} ({myPlayer.camp === 'wolf' ? '狼人阵营' : '好人阵营'})
                  </div>
                </div>
              </div>
            )}

            {/* 警长竞选UI */}
            {currentGame.sheriffElection && myPlayer?.alive && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                {currentGame.sheriffElection.phase === 'signup' && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">🎖️ 警长竞选 - 上警阶段</h3>
                    <p className="text-gray-300 mb-6">请选择是否参加警长竞选</p>

                    {myPlayer.sheriffCandidate === undefined ? (
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleSheriffSignup(true)}
                          className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition"
                        >
                          上警竞选
                        </button>
                        <button
                          onClick={() => handleSheriffSignup(false)}
                          className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
                        >
                          不上警
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-green-400 text-lg">
                          {myPlayer.sheriffCandidate ? '✓ 你已选择上警' : '✓ 你已选择不上警'}
                        </p>
                      </div>
                    )}

                    {currentGame.sheriffElection.candidates.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-white font-bold mb-3">已上警玩家:</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentGame.sheriffElection.candidates.map(candidateId => {
                            const candidate = currentGame.players.find(p => p.playerId === candidateId);
                            return (
                              <div key={candidateId} className="px-4 py-2 bg-yellow-600/30 border border-yellow-500 rounded-lg">
                                <span className="text-white font-bold">{candidateId}号</span>
                                <span className="text-gray-300 ml-2">{candidate?.username}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentGame.sheriffElection.phase === 'campaign' && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">🎖️ 警长竞选 - 竞选发言</h3>
                    <p className="text-gray-300 mb-6">候选人发言中,请等待...</p>

                    <div className="space-y-3">
                      <h4 className="text-white font-bold">候选人:</h4>
                      {currentGame.sheriffElection.candidates.map(candidateId => {
                        const candidate = currentGame.players.find(p => p.playerId === candidateId);
                        return (
                          <div key={candidateId} className="p-4 bg-yellow-600/20 border border-yellow-500 rounded-lg flex justify-between items-center">
                            <div>
                              <span className="text-white font-bold">{candidateId}号</span>
                              <span className="text-gray-300 ml-2">{candidate?.username}</span>
                            </div>
                            {myPlayer.playerId === candidateId && (
                              <button
                                onClick={handleSheriffWithdraw}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                              >
                                退水
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentGame.sheriffElection.phase === 'voting' && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">🎖️ 警长竞选 - 投票阶段</h3>

                    {currentGame.sheriffElection.candidates.includes(myPlayer.playerId) ? (
                      <p className="text-gray-300 text-center">你是候选人,不能投票</p>
                    ) : currentGame.sheriffElection.votes[myPlayer.playerId] !== undefined ? (
                      <div className="text-center">
                        <p className="text-green-400 text-lg">✓ 你已完成投票</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-300">请投票选出警长</p>

                        <div>
                          <label className="block text-white text-sm font-medium mb-2">选择候选人</label>
                          <select
                            value={sheriffVote}
                            onChange={(e) => setSheriffVote(e.target.value === 'skip' ? 'skip' : Number(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-800 border border-yellow-500 rounded-lg text-white"
                          >
                            <option value={0} className="bg-gray-800">请选择...</option>
                            <option value="skip" className="bg-gray-800">弃票</option>
                            {currentGame.sheriffElection.candidates.map(candidateId => {
                              const candidate = currentGame.players.find(p => p.playerId === candidateId);
                              return (
                                <option key={candidateId} value={candidateId} className="bg-gray-800">
                                  {candidateId}号 - {candidate?.username}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          onClick={handleSheriffVote}
                          disabled={isSubmitting}
                          className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                        >
                          {isSubmitting ? '提交中...' : '确认投票'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentGame.sheriffElection.phase === 'done' && currentGame.sheriffElection.result && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">🎖️ 警长当选</h3>
                    <p className="text-yellow-400 text-xl">
                      {currentGame.sheriffElection.result}号 当选警长！
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 放逐投票UI */}
            {currentGame.exileVote && myPlayer?.alive && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                {currentGame.exileVote.phase === 'voting' && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">⚖️ 放逐投票</h3>

                    {currentGame.exileVote.votes[myPlayer.playerId] !== undefined ? (
                      <div className="text-center">
                        <p className="text-green-400 text-lg">✓ 你已完成投票</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-300">请投票决定放逐哪位玩家</p>

                        <div>
                          <label className="block text-white text-sm font-medium mb-2">选择放逐目标</label>
                          <select
                            value={exileVote}
                            onChange={(e) => setExileVote(e.target.value === 'skip' ? 'skip' : Number(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-800 border border-red-500 rounded-lg text-white"
                          >
                            <option value={0} className="bg-gray-800">请选择...</option>
                            <option value="skip" className="bg-gray-800">弃票</option>
                            {currentGame.players
                              .filter(p => p.alive)
                              .map(player => (
                                <option key={player.playerId} value={player.playerId} className="bg-gray-800">
                                  {player.playerId}号 - {player.username}
                                </option>
                              ))}
                          </select>
                        </div>

                        <button
                          onClick={handleExileVote}
                          disabled={isSubmitting}
                          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                        >
                          {isSubmitting ? '提交中...' : '确认投票'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentGame.exileVote.phase === 'pk' && currentGame.exileVote.pkPlayers && (
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-4">⚖️ 平票PK投票</h3>

                    {currentGame.exileVote.pkPlayers.includes(myPlayer.playerId) ? (
                      <p className="text-gray-300 text-center">你在PK中,不能投票</p>
                    ) : currentGame.exileVote.pkVotes?.[myPlayer.playerId] !== undefined ? (
                      <div className="text-center">
                        <p className="text-green-400 text-lg">✓ 你已完成PK投票</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-300 mb-4">以下玩家平票,请投票决定放逐谁</p>

                        <div className="flex flex-wrap gap-3 mb-4">
                          {currentGame.exileVote.pkPlayers.map(playerId => {
                            const player = currentGame.players.find(p => p.playerId === playerId);
                            return (
                              <div key={playerId} className="px-4 py-2 bg-red-600/30 border border-red-500 rounded-lg">
                                <span className="text-white font-bold">{playerId}号</span>
                                <span className="text-gray-300 ml-2">{player?.username}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div>
                          <label className="block text-white text-sm font-medium mb-2">选择放逐目标</label>
                          <select
                            value={exileVote}
                            onChange={(e) => setExileVote(e.target.value === 'skip' ? 'skip' : Number(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-800 border border-red-500 rounded-lg text-white"
                          >
                            <option value={0} className="bg-gray-800">请选择...</option>
                            <option value="skip" className="bg-gray-800">弃票</option>
                            {currentGame.exileVote.pkPlayers.map(playerId => {
                              const player = currentGame.players.find(p => p.playerId === playerId);
                              return (
                                <option key={playerId} value={playerId} className="bg-gray-800">
                                  {playerId}号 - {player?.username}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          onClick={handleExilePKVote}
                          disabled={isSubmitting}
                          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                        >
                          {isSubmitting ? '提交中...' : '确认投票'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentGame.exileVote.phase === 'done' && (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">⚖️ 投票结果</h3>
                    {currentGame.exileVote.result === 'none' ? (
                      <p className="text-gray-300 text-lg">本轮无人被放逐</p>
                    ) : typeof currentGame.exileVote.result === 'number' ? (
                      <p className="text-red-400 text-xl">
                        {currentGame.exileVote.result}号 被放逐出局
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {currentGame.status === 'finished' && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
                <h3 className="text-3xl font-bold text-white mb-4">游戏结束</h3>
                <p className="text-2xl text-gray-300">
                  {currentGame.winner === 'wolf' ? '狼人阵营' : '好人阵营'} 获胜！
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
