import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { Script, ServerMessage } from '../../../shared/src/types';
import { ROLES } from '../../../shared/src/constants';

export default function GodConsole() {
  const { user, token, clearAuth } = useAuthStore();
  const { currentGame, setGame, clearGame } = useGameStore();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    loadScripts();

    const unsubscribe = wsService.onMessage((message: ServerMessage) => {
      switch (message.type) {
        case 'ROOM_CREATED':
          alert(`房间创建成功！房间码：${message.roomCode}`);
          break;
        case 'ROOM_JOINED':
          setGame(message.game);
          break;
        case 'GAME_STATE_UPDATE':
          setGame(message.game);
          break;
        case 'PLAYER_JOINED':
          console.log('Player joined:', message.player);
          break;
        case 'PHASE_CHANGED':
          console.log('Phase changed:', message.phase);
          break;
      }
    });

    return unsubscribe;
  }, []);

  const loadScripts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/scripts');
      const data = await response.json();
      if (data.success) {
        setScripts(data.data.scripts);
        if (data.data.scripts.length > 0) {
          setSelectedScript(data.data.scripts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load scripts:', err);
    }
  };

  const handleCreateRoom = () => {
    if (!selectedScript) {
      alert('请选择剧本');
      return;
    }
    wsService.send({ type: 'CREATE_ROOM', scriptId: selectedScript });
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert('请输入房间码');
      return;
    }
    wsService.send({ type: 'JOIN_ROOM', roomCode: roomCode.trim().toUpperCase() });
  };

  const handleRandomAssignRoles = () => {
    if (!currentGame || !currentScript) return;

    // 构建角色池
    const rolePool: string[] = [];
    currentScript.roles.forEach(role => {
      for (let i = 0; i < role.count; i++) {
        rolePool.push(role.id);
      }
    });

    // 洗牌算法
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    // 分配给玩家
    const newAssignments: { [key: number]: string } = {};
    currentGame.players.forEach((player, index) => {
      newAssignments[player.playerId] = rolePool[index];
    });

    setRoleAssignments(newAssignments);
    alert('角色已随机分配！请确认后点击"确认分配"');
  };

  const handleAssignRoles = () => {
    const assignments = Object.entries(roleAssignments).map(([playerId, roleId]) => ({
      playerId: Number(playerId),
      roleId,
    }));

    if (assignments.length !== currentGame?.players.length) {
      alert('请为所有玩家分配角色');
      return;
    }

    wsService.send({ type: 'GOD_ASSIGN_ROLES', assignments });
    setShowRoleAssignment(false);
  };

  const handleStartGame = () => {
    if (!confirm('确定开始游戏吗？')) return;
    wsService.send({ type: 'GOD_START_GAME' });
  };

  const handleAdvancePhase = () => {
    wsService.send({ type: 'GOD_ADVANCE_PHASE' });
  };

  const handleLogout = () => {
    wsService.disconnect();
    clearAuth();
    clearGame();
  };

  const currentScript = scripts.find((s) => s.id === currentGame?.scriptId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">上帝控制台</h1>
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
            <h2 className="text-2xl font-bold text-white mb-6">创建或加入房间</h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">创建新房间</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">选择剧本</label>
                    <select
                      value={selectedScript}
                      onChange={(e) => setSelectedScript(e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                    >
                      {scripts.map((script) => (
                        <option key={script.id} value={script.id}>
                          {script.name} ({script.playerCount}人)
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateRoom}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition"
                  >
                    创建房间
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">加入已有房间</h3>
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
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    房间码: {currentGame.roomCode}
                  </h2>
                  <p className="text-gray-300">
                    {currentGame.scriptName} | 状态: {currentGame.status === 'waiting' ? '等待中' : currentGame.status === 'running' ? '进行中' : '已结束'}
                  </p>
                </div>
                <div className="flex gap-4">
                  {currentGame.status === 'waiting' && (
                    <>
                      <button
                        onClick={() => setShowRoleAssignment(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                      >
                        分配角色
                      </button>
                      <button
                        onClick={handleStartGame}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                        disabled={currentGame.players.some(p => !p.role)}
                      >
                        开始游戏
                      </button>
                    </>
                  )}
                  {currentGame.status === 'running' && (
                    <button
                      onClick={handleAdvancePhase}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                      进入下一阶段
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {currentGame.players.map((player) => (
                  <div
                    key={player.playerId}
                    className={`p-4 rounded-lg border-2 ${
                      player.alive
                        ? player.isSheriff
                          ? 'bg-yellow-600/20 border-yellow-500'
                          : 'bg-green-600/20 border-green-500'
                        : 'bg-red-600/20 border-red-500'
                    }`}
                  >
                    <div className="text-white font-bold mb-2">
                      {player.playerId}号 {player.isSheriff && '🎖️'}
                    </div>
                    <div className="text-gray-300 text-sm">{player.username}</div>
                    {player.role && (
                      <div className="text-gray-300 text-sm mt-2">
                        {player.role} ({player.camp === 'wolf' ? '狼' : '好人'})
                      </div>
                    )}
                    {!player.alive && (
                      <div className="text-red-400 text-sm mt-1">已出局</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {currentGame.status === 'running' && (
              <>
                {/* 当前阶段操作状态 */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">
                    当前阶段: {currentGame.currentPhase} | 回合: {currentGame.currentRound}
                  </h3>

                  {/* 实时操作状态 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* 恐惧阶段 */}
                    {currentGame.currentPhase === 'fear' && (
                      <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🌙 恐惧阶段</h4>
                        <div className="text-gray-300 text-sm">
                          {currentGame.nightActions.fearSubmitted ? (
                            <div className="text-green-400">
                              ✅ 噩梦之影已选择: {currentGame.nightActions.fear ? `${currentGame.nightActions.fear}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待噩梦之影操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 守护阶段 */}
                    {currentGame.currentPhase === 'dream' && (
                      <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">💤 守护阶段</h4>
                        <div className="text-gray-300 text-sm">
                          {currentGame.nightActions.dreamSubmitted ? (
                            <div className="text-green-400">
                              ✅ 摄梦人已守护: {currentGame.nightActions.dream ? `${currentGame.nightActions.dream}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待摄梦人操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 狼人阶段 */}
                    {currentGame.currentPhase === 'wolf' && (
                      <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🐺 狼人阶段</h4>
                        <div className="text-gray-300 text-sm">
                          {currentGame.nightActions.wolfSubmitted ? (
                            <div className="text-green-400">
                              ✅ 狼人已刀: {currentGame.nightActions.wolfKill ? `${currentGame.nightActions.wolfKill}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待狼人操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 女巫阶段 */}
                    {currentGame.currentPhase === 'witch' && (
                      <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🧪 女巫阶段</h4>
                        <div className="text-gray-300 text-sm space-y-1">
                          <div>昨晚被刀: {currentGame.nightActions.witchKnowsVictim ? `${currentGame.nightActions.witchKnowsVictim}号` : '未知'}</div>
                          {currentGame.nightActions.witchSubmitted ? (
                            <>
                              <div className="text-green-400">✅ 女巫已操作</div>
                              {currentGame.nightActions.witchAction === 'save' && (
                                <div className="text-blue-400">使用了解药</div>
                              )}
                              {currentGame.nightActions.witchAction === 'poison' && (
                                <div className="text-red-400">使用了毒药毒死 {currentGame.nightActions.witchTarget}号</div>
                              )}
                              {currentGame.nightActions.witchAction === 'none' && (
                                <div className="text-gray-400">不使用药水</div>
                              )}
                            </>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待女巫操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 预言家阶段 */}
                    {currentGame.currentPhase === 'seer' && (
                      <div className="p-4 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🔮 预言家阶段</h4>
                        <div className="text-gray-300 text-sm">
                          {currentGame.nightActions.seerSubmitted ? (
                            <>
                              <div className="text-green-400">✅ 预言家已查验</div>
                              {currentGame.nightActions.seerCheck && (
                                <div>
                                  查验 {currentGame.nightActions.seerCheck}号 →{' '}
                                  <span className={currentGame.nightActions.seerResult === 'wolf' ? 'text-red-400' : 'text-blue-400'}>
                                    {currentGame.nightActions.seerResult === 'wolf' ? '狼人' : '好人'}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待预言家操作...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 神职技能状态 */}
                  <div className="mb-6 p-4 bg-white/5 rounded-lg">
                    <h4 className="text-white font-bold mb-2">🎭 神职技能状态</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {currentGame.players.filter(p => p.role === '女巫').map(witch => (
                        <div key={witch.playerId} className="text-gray-300">
                          {witch.playerId}号 女巫:
                          <span className={witch.abilities.antidote ? 'text-green-400' : 'text-gray-500'}>
                            {' '}解药{witch.abilities.antidote ? '✓' : '✗'}
                          </span>
                          <span className={witch.abilities.poison ? 'text-red-400' : 'text-gray-500'}>
                            {' '}毒药{witch.abilities.poison ? '✓' : '✗'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 操作历史 */}
                  <h4 className="text-white font-bold mb-2">📜 操作历史</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentGame.history.slice(-10).reverse().map((log) => (
                      <div key={log.id} className="text-gray-300 text-sm p-2 bg-white/5 rounded">
                        [{log.phase}] {log.result}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {showRoleAssignment && currentGame && currentScript && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">分配角色</h3>
                <button
                  onClick={handleRandomAssignRoles}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
                >
                  🎲 随机分配
                </button>
              </div>

              <div className="mb-4 p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                <h4 className="text-white font-bold mb-2">剧本配置：{currentScript.name}</h4>
                <div className="text-gray-300 text-sm space-y-1">
                  {currentScript.roles.map(role => (
                    <div key={role.id}>
                      {role.name} x{role.count} ({role.camp === 'wolf' ? '狼人' : '好人'})
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {currentGame.players.map((player) => (
                  <div key={player.playerId} className="flex items-center gap-4">
                    <div className="text-white w-32">{player.playerId}号 - {player.username}</div>
                    <select
                      value={roleAssignments[player.playerId] || ''}
                      onChange={(e) =>
                        setRoleAssignments({ ...roleAssignments, [player.playerId]: e.target.value })
                      }
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                    >
                      <option value="">选择角色</option>
                      {currentScript.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} ({role.camp === 'wolf' ? '狼人' : '好人'})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowRoleAssignment(false)}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                >
                  取消
                </button>
                <button
                  onClick={handleAssignRoles}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                >
                  确认分配
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
