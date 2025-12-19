import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage, GamePlayer } from '../../../shared/src/types';

export default function PlayerView() {
  const { user, clearAuth } = useAuthStore();
  const { currentGame, setGame, clearGame } = useGameStore();
  const [roomCode, setRoomCode] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(0);
  const [myPlayer, setMyPlayer] = useState<GamePlayer | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number>(0);

  // 女巫专用状态
  const [witchAction, setWitchAction] = useState<'none' | 'antidote' | 'poison'>('none');
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [poisonTarget, setPoisonTarget] = useState<number>(0);

  // 投票相关状态
  const [sheriffVote, setSheriffVote] = useState<number | 'skip'>(0);
  const [exileVote, setExileVote] = useState<number | 'skip'>(0);

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'ROOM_JOINED':
          setGame(message.game);
          break;
        case 'PLAYER_JOINED':
          // 有新玩家加入,更新玩家列表
          if (currentGame) {
            const updatedGame = { ...currentGame };
            updatedGame.players = [...updatedGame.players, message.player];
            setGame(updatedGame);
          }
          break;
        case 'GAME_STATE_UPDATE':
          setGame(message.game);
          break;
        case 'ROLE_ASSIGNED':
          alert(`你的角色是: ${message.role} (${message.camp === 'wolf' ? '狼人阵营' : '好人阵营'})`);
          break;
        case 'PHASE_CHANGED':
          alert(`进入新阶段: ${message.prompt}`);
          break;
        case 'GAME_FINISHED':
          alert(`游戏结束！${message.winner === 'wolf' ? '狼人' : '好人'}获胜！`);
          break;
        case 'ACTION_RESULT':
          if (message.success) {
            // 如果有额外数据（如预言家查验结果），显示详细信息
            if ((message as any).data?.seerResult) {
              const seerInfo = (message as any).data.seerResult;
              alert(`查验结果：${seerInfo.message}`);
            } else if ((message as any).data?.victimInfo) {
              // 女巫的被刀信息在UI中显示，不需要alert
              // 受害者信息已经在女巫界面中显示
            } else {
              alert('操作成功');
            }
            setSelectedTarget(0);
            // 重置女巫状态
            setWitchAction('none');
            setPoisonTarget(0);
            setShowPoisonModal(false);
          } else {
            alert(message.message);
          }
          break;
      }
    });

    return unsubscribe;
  }, [currentGame, setGame]);

  useEffect(() => {
    if (currentGame && user) {
      const player = currentGame.players.find((p) => p.userId === user.userId);
      setMyPlayer(player || null);
    }
  }, [currentGame, user]);

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert('请输入房间码');
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
      clearGame();
      setMyPlayer(null);
    }
  };

  const handleSubmitAction = () => {
    if (!myPlayer || !currentGame) return;

    const action = {
      phase: currentGame.currentPhase,
      playerId: myPlayer.playerId,
      actionType: 'action',
      target: selectedTarget,
    };

    wsService.send({ type: 'PLAYER_SUBMIT_ACTION', action });
  };

  // 女巫提交操作
  const handleWitchSubmit = () => {
    if (!myPlayer || !currentGame) return;

    let actionType = 'none';
    let target = 0;

    if (witchAction === 'antidote') {
      actionType = 'save';
      target = currentGame.nightActions.witchKnowsVictim || 0;
    } else if (witchAction === 'poison') {
      actionType = 'poison';
      target = poisonTarget;
    }

    const action = {
      phase: currentGame.currentPhase,
      playerId: myPlayer.playerId,
      actionType,
      target,
    };

    wsService.send({ type: 'PLAYER_SUBMIT_ACTION', action });

    // 重置状态
    setWitchAction('none');
    setPoisonTarget(0);
    setShowPoisonModal(false);
  };

  // 女巫选择解药
  const handleUseAntidote = () => {
    setWitchAction('antidote');
  };

  // 女巫选择不使用解药
  const handleNoAntidote = () => {
    setWitchAction('none');
  };

  // 女巫选择使用毒药
  const handleUsePoisonClick = () => {
    setWitchAction('poison');
    setShowPoisonModal(true);
  };

  // 女巫选择不使用毒药
  const handleNoPoison = () => {
    setWitchAction('none');
  };

  // 确认毒药目标
  const handleConfirmPoison = () => {
    if (poisonTarget === 0) {
      alert('请选择毒药目标');
      return;
    }
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

  // 警长竞选:投票
  const handleSheriffVote = () => {
    if (sheriffVote === 0) {
      alert('请选择要投票的候选人,或选择弃票');
      return;
    }
    wsService.send({ type: 'SHERIFF_VOTE', candidateId: sheriffVote });
    setSheriffVote(0);
  };

  // 放逐投票
  const handleExileVote = () => {
    if (exileVote === 0) {
      alert('请选择要投票的玩家,或选择弃票');
      return;
    }
    wsService.send({ type: 'EXILE_VOTE', targetId: exileVote });
    setExileVote(0);
  };

  // 平票PK投票
  const handleExilePKVote = () => {
    if (exileVote === 0) {
      alert('请选择要投票的玩家,或选择弃票');
      return;
    }
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
                  选择号位 <span className="text-gray-400">(可选，留空则自动分配)</span>
                </label>
                <input
                  type="number"
                  value={selectedPlayerId || ''}
                  onChange={(e) => setSelectedPlayerId(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                  placeholder="输入号位 (1-12)"
                  min={1}
                  max={12}
                />
                <p className="text-gray-400 text-xs mt-1">
                  提示：选择你想要的号位，如果号位已被占用则加入失败
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
                  <div className="text-white font-bold text-lg mb-2">
                    你是 {myPlayer.playerId}号 {myPlayer.isSheriff && '🎖️'}
                  </div>
                  {myPlayer.role && (
                    <div className="text-gray-300">
                      角色: {myPlayer.role} | 阵营: {myPlayer.camp === 'wolf' ? '狼人' : '好人'}
                    </div>
                  )}
                  {!myPlayer.alive && (
                    <div className="text-red-400 mt-2">你已出局</div>
                  )}
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
                        <div className="text-red-400 text-sm mt-1">已出局</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {currentGame.status === 'running' && myPlayer?.alive && (
              <>
                {/* 平民和没有夜间行动的角色:夜间不显示操作界面 */}
                {(myPlayer.role === '平民' || !myPlayer.abilities.hasNightAction) &&
                 (currentGame.currentPhase === 'fear' || currentGame.currentPhase === 'dream' ||
                  currentGame.currentPhase === 'wolf' || currentGame.currentPhase === 'witch' ||
                  currentGame.currentPhase === 'seer') ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">🌙 夜晚阶段</h3>
                    <p className="text-gray-300">天黑请闭眼,请等待其他角色行动...</p>
                  </div>
                ) : myPlayer.role === '噩梦之影' && currentGame.currentPhase === 'fear' ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">
                      🌙 恐惧阶段 - 噩梦之影
                    </h3>
                    <p className="text-gray-300 mb-6">选择一名玩家，让其陷入恐惧无法使用技能，或者选择放弃此次行动。</p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          选择恐惧目标
                        </label>
                        <select
                          value={selectedTarget}
                          onChange={(e) => setSelectedTarget(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-800 border border-purple-500/50 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value={0} className="bg-gray-800 text-white">请选择目标...</option>
                          {currentGame.players
                            .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
                            .map((player) => (
                              <option key={player.playerId} value={player.playerId} className="bg-gray-800 text-white">
                                {player.playerId}号 - {player.username}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={handleSubmitAction}
                          disabled={selectedTarget === 0}
                          className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                        >
                          确认恐惧
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTarget(0);
                            const action = {
                              phase: currentGame.currentPhase,
                              playerId: myPlayer.playerId,
                              actionType: 'skip',
                              target: 0,
                            };
                            wsService.send({ type: 'PLAYER_SUBMIT_ACTION', action });
                          }}
                          className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
                        >
                          放弃恐惧
                        </button>
                      </div>
                    </div>
                  </div>
                ) : myPlayer.role === '女巫' && currentGame.currentPhase === 'witch' ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">
                      🧪 女巫阶段
                    </h3>

                    {/* 显示昨晚被刀的人 */}
                    {currentGame.nightActions.witchKnowsVictim && (
                      <div className="mb-6 p-4 bg-red-600/20 border border-red-500 rounded-lg">
                        <p className="text-white font-bold">
                          昨晚被刀: {currentGame.nightActions.witchKnowsVictim}号
                        </p>
                      </div>
                    )}

                    {/* 神职技能状态 */}
                    <div className="mb-6 p-4 bg-white/5 rounded-lg">
                      <h4 className="text-white font-bold mb-2">你的技能状态</h4>
                      <div className="flex gap-4 text-sm">
                        <div className={myPlayer.abilities.antidote ? 'text-green-400' : 'text-gray-500'}>
                          解药 {myPlayer.abilities.antidote ? '✓ 可用' : '✗ 已使用'}
                        </div>
                        <div className={myPlayer.abilities.poison ? 'text-red-400' : 'text-gray-500'}>
                          毒药 {myPlayer.abilities.poison ? '✓ 可用' : '✗ 已使用'}
                        </div>
                      </div>
                    </div>

                    {/* 解药选择 */}
                    <div className="mb-6">
                      <h4 className="text-white font-bold mb-3">💊 解药</h4>
                      <div className="flex gap-4">
                        <button
                          onClick={handleUseAntidote}
                          disabled={!myPlayer.abilities.antidote || witchAction === 'poison'}
                          className={`flex-1 py-3 rounded-lg font-bold transition ${
                            witchAction === 'antidote'
                              ? 'bg-green-600 text-white'
                              : myPlayer.abilities.antidote && witchAction !== 'poison'
                                ? 'bg-green-600/30 hover:bg-green-600/50 text-white'
                                : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          使用解药
                        </button>
                        <button
                          onClick={handleNoAntidote}
                          disabled={witchAction === 'poison'}
                          className={`flex-1 py-3 rounded-lg font-bold transition ${
                            witchAction === 'none'
                              ? 'bg-gray-600 text-white'
                              : witchAction !== 'poison'
                                ? 'bg-gray-600/30 hover:bg-gray-600/50 text-white'
                                : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          不使用
                        </button>
                      </div>
                    </div>

                    {/* 毒药选择 */}
                    <div className="mb-6">
                      <h4 className="text-white font-bold mb-3">☠️ 毒药</h4>
                      <div className="flex gap-4">
                        <button
                          onClick={handleUsePoisonClick}
                          disabled={!myPlayer.abilities.poison || witchAction === 'antidote'}
                          className={`flex-1 py-3 rounded-lg font-bold transition ${
                            witchAction === 'poison'
                              ? 'bg-red-600 text-white'
                              : myPlayer.abilities.poison && witchAction !== 'antidote'
                                ? 'bg-red-600/30 hover:bg-red-600/50 text-white'
                                : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          使用毒药
                        </button>
                        <button
                          onClick={handleNoPoison}
                          disabled={witchAction === 'antidote'}
                          className={`flex-1 py-3 rounded-lg font-bold transition ${
                            witchAction === 'none'
                              ? 'bg-gray-600 text-white'
                              : witchAction !== 'antidote'
                                ? 'bg-gray-600/30 hover:bg-gray-600/50 text-white'
                                : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          不使用
                        </button>
                      </div>
                    </div>

                    {/* 提交按钮 */}
                    <button
                      onClick={handleWitchSubmit}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition"
                    >
                      提交操作
                    </button>

                    {/* 毒药目标选择弹窗 */}
                    {showPoisonModal && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-900 border-2 border-red-500 rounded-2xl p-8 max-w-md w-full mx-4">
                          <h3 className="text-2xl font-bold text-white mb-4">选择毒药目标</h3>
                          <div className="mb-6">
                            <label className="block text-white text-sm font-medium mb-2">
                              选择要毒死的玩家
                            </label>
                            <select
                              value={poisonTarget}
                              onChange={(e) => setPoisonTarget(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-gray-800 border border-red-500/50 rounded-lg text-white focus:border-red-500 focus:outline-none"
                            >
                              <option value={0} className="bg-gray-800 text-white">请选择...</option>
                              {currentGame.players
                                .filter((p) => p.alive)
                                .map((player) => (
                                  <option key={player.playerId} value={player.playerId} className="bg-gray-800 text-white">
                                    {player.playerId}号 - {player.username}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="flex gap-4">
                            <button
                              onClick={handleConfirmPoison}
                              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => {
                                setShowPoisonModal(false);
                                setWitchAction('none');
                                setPoisonTarget(0);
                              }}
                              className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : myPlayer.role === '摄梦人' && currentGame.currentPhase === 'dream' ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">
                      🌙 梦游阶段 - 摄梦人
                    </h3>
                    <p className="text-gray-300 mb-6">
                      选择一名玩家进行梦游。连续2晚梦游同一人会将其梦死,否则守护该玩家。
                    </p>

                    {myPlayer.abilities.lastDreamTarget && (
                      <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded-lg">
                        <p className="text-blue-300 text-sm">
                          💤 上一晚梦游了 {myPlayer.abilities.lastDreamTarget}号
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          选择梦游目标
                        </label>
                        <select
                          value={selectedTarget}
                          onChange={(e) => setSelectedTarget(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-800 border border-blue-500/50 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value={0} className="bg-gray-800 text-white">请选择目标...</option>
                          {currentGame.players
                            .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
                            .map((player) => (
                              <option key={player.playerId} value={player.playerId} className="bg-gray-800 text-white">
                                {player.playerId}号 - {player.username}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={handleSubmitAction}
                        disabled={selectedTarget === 0}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                      >
                        确认梦游
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 其他角色通用操作界面 */
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">
                      当前阶段: {currentGame.currentPhase}
                    </h3>

                    {/* 狼人阶段：显示所有狼人 */}
                    {myPlayer.camp === 'wolf' && currentGame.currentPhase === 'wolf' && (
                      <div className="mb-6 p-4 bg-red-600/20 border border-red-500 rounded-lg">
                        <h4 className="text-white font-bold mb-3">🐺 狼人队友</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {currentGame.players
                            .filter((p) => p.camp === 'wolf' && p.alive)
                            .map((wolf) => (
                              <div
                                key={wolf.playerId}
                                className={`p-3 rounded-lg ${
                                  wolf.playerId === myPlayer.playerId
                                    ? 'bg-red-700/50 border-2 border-red-400'
                                    : 'bg-red-600/30'
                                }`}
                              >
                                <div className="text-white font-bold">
                                  {wolf.playerId}号
                                  {wolf.playerId === myPlayer.playerId && ' (你)'}
                                </div>
                                <div className="text-gray-300 text-sm">{wolf.username}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          选择目标
                        </label>
                        <select
                          value={selectedTarget}
                          onChange={(e) => setSelectedTarget(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-gray-800 border border-white/30 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value={0} className="bg-gray-800 text-white">无</option>
                          {currentGame.players
                            .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
                            .map((player) => (
                              <option key={player.playerId} value={player.playerId} className="bg-gray-800 text-white">
                                {player.playerId}号 - {player.username}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={handleSubmitAction}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition"
                      >
                        提交操作
                      </button>
                    </div>
                  </div>
                )}
              </>
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
                          className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition"
                        >
                          确认投票
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
                          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
                        >
                          确认投票
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
                          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition"
                        >
                          确认投票
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
