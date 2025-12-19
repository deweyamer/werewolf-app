import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { Script, ServerMessage } from '../../../shared/src/types';
import { ROLES } from '../../../shared/src/constants';
import { config } from '../config';
import {
  calculateGameOverview,
  calculatePlayerStats,
  extractNightActionsSummary,
  getRoleStatusText
} from '../utils/gameStats';
import { getPhaseLabel, translateDeathReason, getRoleName } from '../utils/phaseLabels';

export default function GodConsole() {
  const { user, token, clearAuth } = useAuthStore();
  const { currentGame, setGame, clearGame } = useGameStore();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<{ [key: number]: string }>({});
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([1])); // 默认展开第1轮

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
          if (currentGame) {
            const updatedGame = { ...currentGame };
            updatedGame.players = [...updatedGame.players, message.player];
            setGame(updatedGame);
          }
          break;
        case 'PHASE_CHANGED':
          console.log('Phase changed:', message.phase);
          break;
      }
    });

    return unsubscribe;
  }, [currentGame, setGame]);

  const loadScripts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/scripts`);
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

  // 使用 useMemo 缓存统计数据计算
  const gameOverview = useMemo(() => {
    return currentGame ? calculateGameOverview(currentGame) : null;
  }, [currentGame]);

  const playerStats = useMemo(() => {
    return currentGame ? calculatePlayerStats(currentGame) : [];
  }, [currentGame]);

  const nightActionsSummary = useMemo(() => {
    return currentGame ? extractNightActionsSummary(currentGame) : {};
  }, [currentGame]);

  // 按回合和阶段分组历史记录
  const groupHistoryByRounds = () => {
    if (!currentGame) return [];

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

  const toggleRound = (round: number) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(round)) {
      newExpanded.delete(round);
    } else {
      newExpanded.add(round);
    }
    setExpandedRounds(newExpanded);
  };

  // 导出复盘数据
  const handleExportReplay = () => {
    if (!currentGame) return;

    const replayData = {
      游戏信息: {
        房间码: currentGame.roomCode,
        剧本: currentGame.scriptName,
        主持人: currentGame.hostUsername,
        游戏状态: currentGame.status === 'waiting' ? '等待中' :
                  currentGame.status === 'running' ? '进行中' :
                  currentGame.status === 'finished' ? '已结束' : '未知',
        开始时间: currentGame.startedAt || '未开始',
        结束时间: currentGame.finishedAt || '未结束',
        获胜方: currentGame.winner === 'wolf' ? '狼人阵营' :
                currentGame.winner === 'good' ? '好人阵营' : '未决出',
      },
      玩家角色信息: currentGame.players.map(p => ({
        号位: `${p.playerId}号`,
        玩家名: p.username,
        角色: p.role || '未分配',
        阵营: p.camp === 'wolf' ? '狼人' : '好人',
        是否存活: p.alive ? '存活' : '已出局',
        是否警长: p.isSheriff ? '是' : '否',
        出局原因: p.outReason ?
          (p.outReason === 'wolfKill' ? '被狼人刀杀' :
           p.outReason === 'poison' ? '被女巫毒死' :
           p.outReason === 'vote' ? '被投票放逐' :
           p.outReason === 'dreamerKilled' ? '摄梦人殉职' : p.outReason) : '未出局',
      })),
      游戏流程: groupHistoryByRounds().reverse().map(({ round, logs }) => ({
        回合: round === 0 ? '游戏准备' : `第${round}回合`,
        操作记录: logs.map(log => ({
          阶段: getPhaseLabel(log.phase).replace(/[🌙💤🐺🧪🔮⚖️🎖️🗳️🏹☀️⏳🏁]/g, '').trim(),
          时间: new Date(log.timestamp).toLocaleString('zh-CN'),
          操作者: log.actorPlayerId > 0 ? `${log.actorPlayerId}号` : '系统',
          操作类型: log.action,
          目标: log.target ? `${log.target}号` : '无',
          结果: log.result,
        })),
      })),
    };

    const jsonString = JSON.stringify(replayData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `狼人杀复盘_${currentGame.roomCode}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('复盘数据已导出！');
  };

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
            {/* 游戏房间信息和操作按钮 */}
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
                  <button
                    onClick={handleExportReplay}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                  >
                    📥 导出复盘
                  </button>
                </div>
              </div>
            </div>

            {/* P0 Panel 1: 游戏概览统计 */}
            {gameOverview && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                <h3 className="text-2xl font-bold text-white mb-6">📊 游戏概览</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* 当前回合 */}
                  <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                    <div className="text-blue-300 text-sm mb-1">当前回合</div>
                    <div className="text-3xl font-bold text-white">第 {gameOverview.currentRound} 轮</div>
                    <div className="text-gray-300 text-sm mt-1">{getPhaseLabel(gameOverview.currentPhase)}</div>
                  </div>

                  {/* 存活狼人 */}
                  <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg">
                    <div className="text-red-300 text-sm mb-1">存活狼人</div>
                    <div className="text-3xl font-bold text-white">{gameOverview.aliveWolves} 人</div>
                    <div className="text-gray-300 text-sm mt-1">已出局 {gameOverview.deadWolves} 人</div>
                  </div>

                  {/* 存活好人 */}
                  <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg">
                    <div className="text-green-300 text-sm mb-1">存活好人</div>
                    <div className="text-3xl font-bold text-white">{gameOverview.aliveGoods} 人</div>
                    <div className="text-gray-300 text-sm mt-1">已出局 {gameOverview.deadGoods} 人</div>
                  </div>

                  {/* 游戏时长 */}
                  <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
                    <div className="text-purple-300 text-sm mb-1">游戏时长</div>
                    <div className="text-3xl font-bold text-white">
                      {gameOverview.duration || '-'}
                    </div>
                    <div className="text-gray-300 text-sm mt-1">
                      {gameOverview.winner === 'wolf' && '🐺 狼人胜利'}
                      {gameOverview.winner === 'good' && '👥 好人胜利'}
                      {!gameOverview.winner && '游戏进行中'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* P0 Panel 2: 玩家状态表格 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-6">👥 玩家状态</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="pb-3 text-gray-300 font-semibold">号位</th>
                      <th className="pb-3 text-gray-300 font-semibold">玩家名</th>
                      <th className="pb-3 text-gray-300 font-semibold">角色</th>
                      <th className="pb-3 text-gray-300 font-semibold">阵营</th>
                      <th className="pb-3 text-gray-300 font-semibold">状态</th>
                      <th className="pb-3 text-gray-300 font-semibold">技能次数</th>
                      <th className="pb-3 text-gray-300 font-semibold">出局信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((player) => (
                      <tr
                        key={player.playerId}
                        className={`border-b border-white/10 ${
                          !player.alive ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 text-white font-bold">
                          {player.playerId}号
                          {player.isSheriff && ' 🎖️'}
                        </td>
                        <td className="py-3 text-gray-300">{player.username}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-sm ${
                              player.camp === 'wolf'
                                ? 'bg-red-600/30 text-red-300'
                                : 'bg-blue-600/30 text-blue-300'
                            }`}
                          >
                            {player.roleName}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-sm font-bold ${
                              player.camp === 'wolf'
                                ? 'bg-red-600/50 text-red-200'
                                : 'bg-green-600/50 text-green-200'
                            }`}
                          >
                            {player.camp === 'wolf' ? '狼人' : '好人'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded text-sm ${
                              player.alive
                                ? 'bg-green-600/30 text-green-300'
                                : 'bg-gray-600/30 text-gray-400'
                            }`}
                          >
                            {player.alive ? '✓ 存活' : '✗ 已出局'}
                          </span>
                        </td>
                        <td className="py-3 text-gray-300">{player.actionCount} 次</td>
                        <td className="py-3 text-gray-300">
                          {!player.alive && player.outReasonText && (
                            <div className="text-sm">
                              <div>{player.outReasonText}</div>
                              {player.deathRound && (
                                <div className="text-gray-500 text-xs">
                                  第 {player.deathRound} 回合
                                </div>
                              )}
                            </div>
                          )}
                          {player.alive && '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {currentGame.status === 'running' && (
              <>
                {/* P0 Panel 3: 实时操作状态 */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                  <h3 className="text-2xl font-bold text-white mb-4">
                    🎮 当前阶段: {getPhaseLabel(currentGame.currentPhase)} | 第 {currentGame.currentRound} 回合
                  </h3>

                  {/* 实时操作状态 - 使用 nightActionsSummary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {/* 恐惧阶段 */}
                    {nightActionsSummary.fear && (
                      <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🌙 噩梦之影 ({nightActionsSummary.fear.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.fear.submitted ? (
                            <div className="text-green-400">
                              ✅ 已选择: {nightActionsSummary.fear.targetId ? `${nightActionsSummary.fear.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 摄梦人阶段 */}
                    {nightActionsSummary.dream && (
                      <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">💤 摄梦人 ({nightActionsSummary.dream.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.dream.submitted ? (
                            <div className="text-green-400">
                              ✅ 已摄梦: {nightActionsSummary.dream.targetId ? `${nightActionsSummary.dream.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 石像鬼阶段 */}
                    {nightActionsSummary.gargoyle && (
                      <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🗿 石像鬼 ({nightActionsSummary.gargoyle.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.gargoyle.submitted ? (
                            <div className="text-green-400">
                              ✅ 已查验: {nightActionsSummary.gargoyle.targetId ? `${nightActionsSummary.gargoyle.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 守卫阶段 */}
                    {nightActionsSummary.guard && (
                      <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🛡️ 守卫 ({nightActionsSummary.guard.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.guard.submitted ? (
                            <div className="text-green-400">
                              ✅ 已守护: {nightActionsSummary.guard.targetId ? `${nightActionsSummary.guard.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 狼人阶段 */}
                    {nightActionsSummary.wolf && (
                      <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🐺 狼人刀人</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.wolf.submitted ? (
                            <>
                              <div className="text-green-400">
                                ✅ 已刀: {nightActionsSummary.wolf.targetId ? `${nightActionsSummary.wolf.targetId}号` : '无目标'}
                              </div>
                              {nightActionsSummary.wolf.voters && nightActionsSummary.wolf.voters.length > 0 && (
                                <div className="text-gray-400 text-xs mt-1">
                                  投票: {nightActionsSummary.wolf.voters.join(', ')}号
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 狼美人阶段 */}
                    {nightActionsSummary.wolfBeauty && (
                      <div className="p-4 bg-pink-600/20 border border-pink-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">💃 狼美人 ({nightActionsSummary.wolfBeauty.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.wolfBeauty.submitted ? (
                            <div className="text-green-400">
                              ✅ 已魅惑: {nightActionsSummary.wolfBeauty.targetId ? `${nightActionsSummary.wolfBeauty.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 女巫阶段 */}
                    {nightActionsSummary.witch && (
                      <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🧪 女巫 ({nightActionsSummary.witch.actorId}号)</h4>
                        <div className="text-gray-300 text-sm space-y-1">
                          {nightActionsSummary.witch.victimId && (
                            <div className="text-red-300">昨晚被刀: {nightActionsSummary.witch.victimId}号</div>
                          )}
                          {nightActionsSummary.witch.submitted ? (
                            <>
                              <div className="text-green-400">✅ 已操作</div>
                              {nightActionsSummary.witch.action === 'save' && (
                                <div className="text-blue-400">使用了解药</div>
                              )}
                              {nightActionsSummary.witch.action === 'poison' && (
                                <div className="text-red-400">使用了毒药毒死 {nightActionsSummary.witch.targetId}号</div>
                              )}
                              {nightActionsSummary.witch.action === 'none' && (
                                <div className="text-gray-400">不使用药水</div>
                              )}
                            </>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 预言家阶段 */}
                    {nightActionsSummary.seer && (
                      <div className="p-4 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">🔮 预言家 ({nightActionsSummary.seer.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.seer.submitted ? (
                            <>
                              <div className="text-green-400">✅ 已查验</div>
                              {nightActionsSummary.seer.targetId && (
                                <div>
                                  查验 {nightActionsSummary.seer.targetId}号 →{' '}
                                  <span className={nightActionsSummary.seer.result === 'wolf' ? 'text-red-400' : 'text-blue-400'}>
                                    {nightActionsSummary.seer.result === 'wolf' ? '狼人' : '好人'}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 守墓人阶段 */}
                    {nightActionsSummary.gravekeeper && (
                      <div className="p-4 bg-gray-600/20 border border-gray-500/50 rounded-lg">
                        <h4 className="text-white font-bold mb-2">⚰️ 守墓人 ({nightActionsSummary.gravekeeper.actorId}号)</h4>
                        <div className="text-gray-300 text-sm">
                          {nightActionsSummary.gravekeeper.submitted ? (
                            <div className="text-green-400">
                              ✅ 已验尸: {nightActionsSummary.gravekeeper.targetId ? `${nightActionsSummary.gravekeeper.targetId}号` : '无目标'}
                            </div>
                          ) : (
                            <div className="text-yellow-400">⏳ 等待操作...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 神职技能状态 */}
                  <div className="p-4 bg-white/5 rounded-lg">
                    <h4 className="text-white font-bold mb-3">🎭 神职技能状态</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {playerStats.map((player) => {
                        const status = getRoleStatusText(currentGame.players.find(p => p.playerId === player.playerId)!);
                        if (status === '正常' || !player.alive) return null;
                        return (
                          <div key={player.playerId} className="text-gray-300 text-sm p-2 bg-white/5 rounded">
                            <span className="text-white font-semibold">{player.playerId}号 {player.roleName}:</span>
                            <span className="ml-2">{status}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 操作历史（按回合分组） */}
                  <h4 className="text-white font-bold mb-2">📜 游戏流程历史</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
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
