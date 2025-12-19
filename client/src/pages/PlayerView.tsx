import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage, GamePlayer } from '../../../shared/src/types';

export default function PlayerView() {
  const { user, clearAuth } = useAuthStore();
  const { currentGame, setGame, clearGame } = useGameStore();
  const [roomCode, setRoomCode] = useState('');
  const [myPlayer, setMyPlayer] = useState<GamePlayer | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number>(0);

  // 女巫专用状态
  const [witchAction, setWitchAction] = useState<'none' | 'antidote' | 'poison'>('none');
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [poisonTarget, setPoisonTarget] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'ROOM_JOINED':
          setGame(message.game);
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
  }, []);

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
    wsService.send({ type: 'JOIN_ROOM', roomCode: roomCode.trim().toUpperCase() });
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
                {/* 女巫专用操作界面 */}
                {myPlayer.role === '女巫' && currentGame.currentPhase === 'witch' ? (
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
                              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white"
                            >
                              <option value={0}>请选择...</option>
                              {currentGame.players
                                .filter((p) => p.alive)
                                .map((player) => (
                                  <option key={player.playerId} value={player.playerId}>
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
                ) : (
                  /* 其他角色通用操作界面 */
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">
                      当前阶段: {currentGame.currentPhase}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          选择目标
                        </label>
                        <select
                          value={selectedTarget}
                          onChange={(e) => setSelectedTarget(Number(e.target.value))}
                          className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                        >
                          <option value={0}>无</option>
                          {currentGame.players
                            .filter((p) => p.alive && p.playerId !== myPlayer.playerId)
                            .map((player) => (
                              <option key={player.playerId} value={player.playerId}>
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
