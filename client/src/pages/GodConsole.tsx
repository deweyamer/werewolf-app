import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ScriptV2, ServerMessage, GameReplayData } from '../../../shared/src/types';
import { ROLES } from '../../../shared/src/constants';
import { config } from '../config';
import {
  calculateGameOverview,
  calculatePlayerStats,
  extractNightActionsSummary,
  getRoleStatusText
} from '../utils/gameStats';
import { getPhaseLabel, translateDeathReason, getRoleName } from '../utils/phaseLabels';
import { useToast } from '../components/Toast';
import { useGameSocket } from '../hooks/useGameSocket';
import RoleSelector from '../components/RoleSelector';
import MiniOverviewSidebar from '../components/god/MiniOverviewSidebar';
import PlayerTableDrawer from '../components/god/PlayerTableDrawer';
import GameReplayViewer from '../components/replay/GameReplayViewer';
import RoomLobby from '../components/god/RoomLobby';
import RoleAssignmentModal from '../components/god/RoleAssignmentModal';
import SheriffElectionPanel from '../components/god/SheriffElectionPanel';
import ExileVotePanel from '../components/god/ExileVotePanel';
import NightActionsPanel from '../components/god/NightActionsPanel';
import GameHistoryPanel from '../components/god/GameHistoryPanel';
import { useReplayData } from '../hooks/useReplayData';

export default function GodConsole() {
  const { user, token, clearAuth } = useAuthStore();
  const toast = useToast();
  const { currentGame, clearGame } = useGameStore();
  const [scripts, setScripts] = useState<ScriptV2[]>([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<{ [key: number]: string }>({});
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([1])); // 默认展开第1轮
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [customScript, setCustomScript] = useState<ScriptV2 | null>(null);
  const [isPlayerTableDrawerOpen, setIsPlayerTableDrawerOpen] = useState(false);
  const [isReplayViewerOpen, setIsReplayViewerOpen] = useState(false);
  const [replayData, setReplayData] = useState<GameReplayData | null>(null);

  const { generateReplayData } = useReplayData(currentGame);

  // 页面特定消息处理（通用消息由 useGameSocket 统一处理）
  const handlePageMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'ROOM_CREATED':
        toast(`房间创建成功！房间码：${message.roomCode}`, 'success', 5000);
        break;
      case 'PHASE_CHANGED':
        console.log('Phase changed:', message.phase);
        break;
    }
  }, [toast]);

  useGameSocket(handlePageMessage);

  useEffect(() => { loadScripts(); }, []);

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
      toast('请选择剧本', 'warning');
      return;
    }
    wsService.send({ type: 'CREATE_ROOM', scriptId: selectedScript });
  };

  const handleCreateTestGame = () => {
    if (!selectedScript) {
      toast('请选择剧本', 'warning');
      return;
    }
    wsService.send({ type: 'GOD_CREATE_TEST_GAME', scriptId: selectedScript });
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast('请输入房间码', 'warning');
      return;
    }
    wsService.send({ type: 'JOIN_ROOM', roomCode: roomCode.trim().toUpperCase() });
  };

  // 创建自定义剧本
  const handleCreateCustomScript = (composition: { [roleId: string]: number }, playerCount: number) => {
    // 生成临时剧本
    const script: ScriptV2 = {
      id: `custom-${Date.now()}`,
      name: `${playerCount}人自定义剧本`,
      description: '用户自定义的剧本配置',
      playerCount,
      roleComposition: composition,
      difficulty: 'medium',
      tags: ['自定义', `${playerCount}人`],
      rules: '用户自定义配置',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomScript(script);
    setShowRoleSelector(false);

    // 发送创建房间请求（带自定义剧本）
    wsService.send({ type: 'CREATE_ROOM_WITH_CUSTOM_SCRIPT', script });
  };

  const handleRandomAssignRoles = () => {
    if (!currentGame || !currentScript || currentScriptRoles.length === 0) {
      toast('无法随机分配：游戏或剧本信息缺失', 'error');
      return;
    }

    // 构建角色池
    const rolePool: string[] = [];
    currentScriptRoles.forEach(role => {
      for (let i = 0; i < role.count; i++) {
        rolePool.push(role.id);
      }
    });

    // 验证角色池和玩家数量是否匹配
    if (rolePool.length !== currentGame.players.length) {
      toast(`错误：角色数量(${rolePool.length})与玩家数量(${currentGame.players.length})不匹配！`, 'error');
      return;
    }

    // 洗牌算法（Fisher-Yates）
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    // 按照玩家号位排序，确保分配顺序正确
    const sortedPlayers = [...currentGame.players].sort((a, b) => a.playerId - b.playerId);

    // 分配给玩家
    const newAssignments: { [key: number]: string } = {};
    sortedPlayers.forEach((player, index) => {
      newAssignments[player.playerId] = rolePool[index];
    });

    setRoleAssignments(newAssignments);
    toast('角色已随机分配！请确认后点击"确认分配"', 'success');
  };

  const handleAssignRoles = () => {
    if (!currentGame) return;

    // 检查是否所有玩家都已分配角色
    const assignments = Object.entries(roleAssignments)
      .filter(([_, roleId]) => roleId) // 过滤掉空角色
      .map(([playerId, roleId]) => ({
        playerId: Number(playerId),
        roleId,
      }));

    if (assignments.length !== currentGame.players.length) {
      toast(`请为所有玩家分配角色！当前已分配 ${assignments.length}/${currentGame.players.length} 个角色`, 'warning');
      return;
    }

    // 验证每个玩家都有角色
    const missingPlayers = currentGame.players.filter(
      p => !roleAssignments[p.playerId]
    );
    if (missingPlayers.length > 0) {
      toast(`以下玩家还未分配角色：${missingPlayers.map(p => `${p.playerId}号`).join(', ')}`, 'warning');
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

  // 将 ScriptV2 的 roleComposition 转换为 RoleConfig 数组
  const currentScriptRoles = useMemo(() => {
    if (!currentScript) return [];

    return Object.entries(currentScript.roleComposition).map(([roleId, count]) => {
      const roleInfo = ROLES[roleId];
      return {
        id: roleId,
        name: roleInfo?.name || roleId,
        camp: roleInfo?.camp || 'good',
        count: count,
        abilities: roleInfo?.abilities || [],
        description: roleInfo?.description || ''
      };
    });
  }, [currentScript]);

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

  // 打开可视化复盘
  const handleOpenReplayViewer = () => {
    const data = generateReplayData();
    if (data) {
      setReplayData(data);
      setIsReplayViewerOpen(true);
    }
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
        角色: p.role ? getRoleName(p.role) : '未分配',
        阵营: p.camp === 'wolf' ? '狼人' : '好人',
        是否存活: p.alive ? '存活' : '已出局',
        是否警长: p.isSheriff ? '是' : '否',
        出局原因: p.outReason ? translateDeathReason(p.outReason) : '未出局',
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

    toast('复盘数据已导出！', 'success');
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
          <RoomLobby
            scripts={scripts}
            selectedScript={selectedScript}
            setSelectedScript={setSelectedScript}
            onCreateRoom={handleCreateRoom}
            onCreateTestGame={handleCreateTestGame}
            onJoinRoom={handleJoinRoom}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onShowRoleSelector={() => setShowRoleSelector(true)}
          />
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
                    {currentGame.scriptName} | 状态: {currentGame.status === 'waiting' ? '等待中' : currentGame.status === 'running' ? '进行中' : currentGame.status === 'paused' ? '已暂停' : '已结束'}
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
                    <>
                      <button
                        onClick={handleAdvancePhase}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                      >
                        进入下一阶段
                      </button>
                      <button
                        onClick={() => wsService.send({ type: 'GOD_PAUSE_GAME' })}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
                      >
                        暂停游戏
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定要强制结束游戏吗？此操作不可撤回。')) {
                            wsService.send({ type: 'GOD_FORCE_END_GAME' });
                          }
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        强制结束
                      </button>
                    </>
                  )}
                  {currentGame.status === 'paused' && (
                    <>
                      <button
                        onClick={() => wsService.send({ type: 'GOD_RESUME_GAME' })}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                      >
                        恢复游戏
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定要强制结束游戏吗？此操作不可撤回。')) {
                            wsService.send({ type: 'GOD_FORCE_END_GAME' });
                          }
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        强制结束
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleOpenReplayViewer}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    📊 可视化复盘
                  </button>
                  <button
                    onClick={handleExportReplay}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                  >
                    📥 导出JSON
                  </button>
                </div>
              </div>
            </div>

            {/* 游戏进行中：左右分栏布局 */}
            {(currentGame.status === 'running' || currentGame.status === 'paused') && gameOverview ? (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* 左侧：行动主区域 (70%) */}
                <div className="flex-1 lg:flex-[7] space-y-4">
                  {/* 当前阶段 */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold text-white">
                        当前阶段: {getPhaseLabel(currentGame.currentPhase)} | 第 {currentGame.currentRound} 回合
                      </h3>
                      {/* 警长信息显示 */}
                      {currentGame.sheriffId > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-600/30 border border-yellow-500 rounded-lg">
                          <span className="text-yellow-400 text-lg">警长:</span>
                          <span className="text-white font-bold text-lg">{currentGame.sheriffId}号</span>
                          <span className="text-gray-300 text-sm">
                            ({currentGame.players.find(p => p.playerId === currentGame.sheriffId)?.username})
                          </span>
                        </div>
                      )}
                      {currentGame.sheriffBadgeState === 'destroyed' && (
                        <div className="px-4 py-2 bg-gray-600/30 border border-gray-500 rounded-lg">
                          <span className="text-gray-400">警徽已流失</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <SheriffElectionPanel currentGame={currentGame} />

                  <ExileVotePanel currentGame={currentGame} />

                  {/* 实时操作状态 - 使用 nightActionsSummary */}
                  <NightActionsPanel currentGame={currentGame} nightActionsSummary={nightActionsSummary} />

                  {/* 神职技能状态 */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
                    <h4 className="text-xl font-bold text-white mb-4">神职技能状态</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {playerStats.map((player) => {
                        const gamePlayer = currentGame.players.find(p => p.playerId === player.playerId);
                        if (!gamePlayer) return null;
                        const status = getRoleStatusText(gamePlayer);
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

                  <GameHistoryPanel
                    currentGame={currentGame}
                    expandedRounds={expandedRounds}
                    toggleRound={toggleRound}
                  />
                </div>

                {/* 右侧：Mini概览 (30%) */}
                <div className="w-full lg:w-72 lg:flex-shrink-0 order-first lg:order-last">
                  <MiniOverviewSidebar
                    gameOverview={gameOverview}
                    playerStats={playerStats}
                    onOpenDrawer={() => setIsPlayerTableDrawerOpen(true)}
                  />
                </div>
              </div>
            ) : (
              /* 游戏等待中：保持原有的垂直布局 */
              <>
                {/* 游戏概览统计 */}
                {gameOverview && (
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                    <h3 className="text-2xl font-bold text-white mb-6">游戏概览</h3>
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
                          {gameOverview.winner === 'wolf' && '狼人胜利'}
                          {gameOverview.winner === 'good' && '好人胜利'}
                          {!gameOverview.winner && '游戏进行中'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 玩家状态表格 */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
                  <h3 className="text-2xl font-bold text-white mb-6">玩家状态</h3>
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
                          <th className="pb-3 text-gray-300 font-semibold">操作</th>
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
                              {player.role ? (
                                <span
                                  className={`px-2 py-1 rounded text-sm font-bold ${
                                    player.camp === 'wolf'
                                      ? 'bg-red-600/50 text-red-200'
                                      : 'bg-green-600/50 text-green-200'
                                  }`}
                                >
                                  {player.camp === 'wolf' ? '狼人' : '好人'}
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded text-sm text-gray-400">
                                  未分配
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-1 rounded text-sm ${
                                  player.alive
                                    ? 'bg-green-600/30 text-green-300'
                                    : 'bg-gray-600/30 text-gray-400'
                                }`}
                              >
                                {player.alive ? '存活' : '已出局'}
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
                            <td className="py-3">
                              {player.alive && (
                                <button
                                  onClick={() => {
                                    if (confirm(`确定要踢出 ${player.playerId}号 ${player.username} 吗？`)) {
                                      wsService.send({ type: 'GOD_KICK_PLAYER', playerId: player.playerId });
                                    }
                                  }}
                                  className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 text-sm rounded transition"
                                >
                                  踢出
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 自定义剧本选择器 */}
        {showRoleSelector && (
          <RoleSelector
            onComplete={handleCreateCustomScript}
            onCancel={() => setShowRoleSelector(false)}
          />
        )}

        <RoleAssignmentModal
          show={showRoleAssignment}
          onClose={() => setShowRoleAssignment(false)}
          currentGame={currentGame!}
          currentScript={currentScript}
          currentScriptRoles={currentScriptRoles}
          roleAssignments={roleAssignments}
          setRoleAssignments={setRoleAssignments}
          onRandomAssign={handleRandomAssignRoles}
          onAssignRoles={handleAssignRoles}
        />

        {/* 玩家详细状态抽屉 */}
        <PlayerTableDrawer
          isOpen={isPlayerTableDrawerOpen}
          onClose={() => setIsPlayerTableDrawerOpen(false)}
          playerStats={playerStats}
        />

        {/* 可视化复盘组件 */}
        <GameReplayViewer
          isOpen={isReplayViewerOpen}
          onClose={() => setIsReplayViewerOpen(false)}
          replayData={replayData}
        />
      </div>
    </div>
  );
}
