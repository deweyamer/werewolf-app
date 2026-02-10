/**
 * GodConsole V2 — 上帝控制台
 *
 * 信息架构：
 *  P0 主画布 = 当前阶段操作（夜晚卡片 / 白天投票 / 警长竞选）
 *  P1 右侧栏 = 神职技能概览 + 阵营存亡
 *  P2 Drawer  = 历史回溯（按需）
 *  P3 Bottom  = 复盘 / 导出入口
 *
 * 自适应：桌面两栏 → 平板/手机单栏堆叠
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ScriptV2, ServerMessage, GameReplayData } from '../../../shared/src/types';
import { ROLE_INFO } from '../../../shared/src/constants';
import { config } from '../config';
import { getPhaseLabel, getPhaseHint, getRoleName, translateDeathReason } from '../utils/phaseLabels';
import { useToast } from '../components/Toast';
import { useGameSocket } from '../hooks/useGameSocket';
import { useReplayData } from '../hooks/useReplayData';

// Sub-components — pre-game
import RoleSelector from '../components/RoleSelector';
import RoomLobby from '../components/god/RoomLobby';
import RoleAssignmentModal from '../components/god/RoleAssignmentModal';

// Sub-components — V2 panels
import PhaseProgressBar from '../components/god/PhaseProgressBar';
import NightActionCards from '../components/god/NightActionCards';
import RoleStatusPanel from '../components/god/RoleStatusPanel';
import CampOverviewPanel from '../components/god/CampOverviewPanel';
import HistoryDrawer from '../components/god/HistoryDrawer';

// Sub-components — existing
import SheriffElectionPanel from '../components/god/SheriffElectionPanel';
import ExileVotePanel from '../components/god/ExileVotePanel';
import NightDeathNotification from '../components/god/NightDeathNotification';
import PhaseTransitionOverlay from '../components/god/PhaseTransitionOverlay';
import PlayerTableDrawer from '../components/god/PlayerTableDrawer';
import GameReplayViewer from '../components/replay/GameReplayViewer';
import { calculatePlayerStats } from '../utils/gameStats';

export default function GodConsole() {
  const { user, clearAuth } = useAuthStore();
  const toast = useToast();
  const { currentGame, clearGame } = useGameStore();

  // Pre-game state
  const [scripts, setScripts] = useState<ScriptV2[]>([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<{ [key: number]: string }>({});
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  // V2 UI state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [isPlayerTableDrawerOpen, setIsPlayerTableDrawerOpen] = useState(false);
  const [isReplayViewerOpen, setIsReplayViewerOpen] = useState(false);
  const [replayData, setReplayData] = useState<GameReplayData | null>(null);

  // Phase transition overlay
  const [showTransition, setShowTransition] = useState(false);
  const [transitionInfo, setTransitionInfo] = useState<{
    phase: string;
    phaseType: 'night' | 'day' | 'transition';
    prompt: string;
  } | null>(null);
  const [lastPhaseType, setLastPhaseType] = useState<string>('');

  // Night death notification
  const [lastNotifiedRound, setLastNotifiedRound] = useState(0);
  const [showDeathNotice, setShowDeathNotice] = useState(false);

  const { generateReplayData } = useReplayData(currentGame);

  // WebSocket message handling
  const handlePageMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'ROOM_CREATED':
        toast(`房间创建成功！房间码：${message.roomCode}`, 'success', 5000);
        break;
      case 'PHASE_CHANGED': {
        const phaseType = (message as any).phaseType || 'transition';
        if (phaseType !== lastPhaseType && (phaseType === 'night' || phaseType === 'day')) {
          setTransitionInfo({
            phase: message.phase,
            phaseType,
            prompt: (message as any).prompt || '',
          });
          setShowTransition(true);
        }
        setLastPhaseType(phaseType);
        break;
      }
    }
  }, [toast, lastPhaseType]);

  useGameSocket(handlePageMessage);

  // Detect night settlement → show death notification
  useEffect(() => {
    const history = currentGame?.roundHistory;
    if (!history?.length) return;
    const latest = history[history.length - 1];
    if (latest.round > lastNotifiedRound) {
      setLastNotifiedRound(latest.round);
      setShowDeathNotice(true);
    }
  }, [currentGame?.roundHistory?.length]);

  // Load scripts
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

  // Actions
  const handleCreateRoom = () => {
    if (!selectedScript) { toast('请选择剧本', 'warning'); return; }
    wsService.send({ type: 'CREATE_ROOM', scriptId: selectedScript });
  };

  const handleCreateTestGame = () => {
    if (!selectedScript) { toast('请选择剧本', 'warning'); return; }
    wsService.send({ type: 'GOD_CREATE_TEST_GAME', scriptId: selectedScript });
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) { toast('请输入房间码', 'warning'); return; }
    wsService.send({ type: 'JOIN_ROOM', roomCode: roomCode.trim().toUpperCase() });
  };

  const handleCreateCustomScript = (composition: { [roleId: string]: number }, playerCount: number) => {
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
    setShowRoleSelector(false);
    wsService.send({ type: 'CREATE_ROOM_WITH_CUSTOM_SCRIPT', script });
  };

  const currentScript = scripts.find((s) => s.id === currentGame?.scriptId);

  const currentScriptRoles = useMemo(() => {
    if (!currentScript) return [];
    return Object.entries(currentScript.roleComposition).map(([roleId, count]) => {
      const roleInfo = ROLE_INFO[roleId];
      return {
        id: roleId,
        name: roleInfo?.name || roleId,
        camp: roleInfo?.camp || 'good',
        count: count,
        abilities: roleInfo?.abilities || [],
        description: roleInfo?.description || '',
      };
    });
  }, [currentScript]);

  const handleRandomAssignRoles = () => {
    if (!currentGame || !currentScript || currentScriptRoles.length === 0) {
      toast('无法随机分配：游戏或剧本信息缺失', 'error');
      return;
    }
    const rolePool: string[] = [];
    currentScriptRoles.forEach(role => {
      for (let i = 0; i < role.count; i++) rolePool.push(role.id);
    });
    if (rolePool.length !== currentGame.players.length) {
      toast(`错误：角色数量(${rolePool.length})与玩家数量(${currentGame.players.length})不匹配！`, 'error');
      return;
    }
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }
    const sortedPlayers = [...currentGame.players].sort((a, b) => a.playerId - b.playerId);
    const newAssignments: { [key: number]: string } = {};
    sortedPlayers.forEach((player, index) => { newAssignments[player.playerId] = rolePool[index]; });
    setRoleAssignments(newAssignments);
    toast('角色已随机分配！请确认后点击"确认分配"', 'success');
  };

  const handleAssignRoles = () => {
    if (!currentGame) return;
    const assignments = Object.entries(roleAssignments)
      .filter(([_, roleId]) => roleId)
      .map(([playerId, roleId]) => ({ playerId: Number(playerId), roleId }));
    if (assignments.length !== currentGame.players.length) {
      toast(`请为所有玩家分配角色！当前已分配 ${assignments.length}/${currentGame.players.length}`, 'warning');
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

  const handleOpenReplayViewer = () => {
    const data = generateReplayData();
    if (data) { setReplayData(data); setIsReplayViewerOpen(true); }
  };

  const handleExportReplay = () => {
    if (!currentGame) return;
    const playerStats = calculatePlayerStats(currentGame);
    const replayExport = {
      游戏信息: {
        房间码: currentGame.roomCode,
        剧本: currentGame.scriptName,
        主持人: currentGame.hostUsername,
        游戏状态: currentGame.status === 'waiting' ? '等待中' : currentGame.status === 'running' ? '进行中' : currentGame.status === 'finished' ? '已结束' : '未知',
        开始时间: currentGame.startedAt || '未开始',
        结束时间: currentGame.finishedAt || '未结束',
        获胜方: currentGame.winner === 'wolf' ? '狼人阵营' : currentGame.winner === 'good' ? '好人阵营' : '未决出',
      },
      玩家角色信息: currentGame.players.map(p => ({
        号位: `${p.playerId}号`, 玩家名: p.username,
        角色: p.role ? getRoleName(p.role) : '未分配',
        阵营: p.camp === 'wolf' ? '狼人' : '好人',
        是否存活: p.alive ? '存活' : '已出局',
        出局原因: p.outReason ? translateDeathReason(p.outReason) : '未出局',
      })),
      游戏流程: currentGame.history.map(log => ({
        回合: log.round, 阶段: getPhaseLabel(log.phase),
        操作者: log.actorPlayerId > 0 ? `${log.actorPlayerId}号` : '系统',
        结果: log.result,
      })),
    };
    const blob = new Blob([JSON.stringify(replayExport, null, 2)], { type: 'application/json;charset=utf-8' });
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

  const isGameRunning = currentGame?.status === 'running';
  const isGameWaiting = currentGame?.status === 'waiting';
  const isGameFinished = currentGame?.status === 'finished';

  // ============================
  // Pre-game: no game yet
  // ============================
  if (!currentGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1">上帝控制台</h1>
              <p className="text-gray-400 text-sm">欢迎, {user?.username}</p>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition">
              退出登录
            </button>
          </div>
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
        </div>
        {showRoleSelector && (
          <RoleSelector onComplete={handleCreateCustomScript} onCancel={() => setShowRoleSelector(false)} />
        )}
      </div>
    );
  }

  // ============================
  // Waiting: game created, waiting for players / role assignment
  // ============================
  if (isGameWaiting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                房间 #{currentGame.roomCode} · {currentGame.scriptName}
              </h1>
              <p className="text-gray-400 text-sm">等待玩家加入 · {currentGame.players.length} 人已加入</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowRoleAssignment(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
                分配角色
              </button>
              <button onClick={handleStartGame}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition disabled:opacity-50"
                disabled={currentGame.players.some(p => !p.role)}>
                开始游戏
              </button>
              <button onClick={handleLogout}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-sm rounded-lg transition border border-white/10">
                退出
              </button>
            </div>
          </div>

          {/* Players table */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/20 overflow-x-auto">
            <h3 className="text-lg font-bold text-white mb-4">玩家列表</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="pb-2 text-gray-400">号位</th>
                  <th className="pb-2 text-gray-400">玩家</th>
                  <th className="pb-2 text-gray-400">角色</th>
                  <th className="pb-2 text-gray-400">阵营</th>
                </tr>
              </thead>
              <tbody>
                {[...currentGame.players].sort((a, b) => a.playerId - b.playerId).map(p => (
                  <tr key={p.playerId} className="border-b border-white/5">
                    <td className="py-2 text-white font-bold">{p.playerId}号</td>
                    <td className="py-2 text-gray-300">{p.username}{p.isBot ? ' 🤖' : ''}</td>
                    <td className="py-2">
                      {p.role ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${p.camp === 'wolf' ? 'bg-red-600/30 text-red-300' : 'bg-blue-600/30 text-blue-300'}`}>
                          {getRoleName(p.role)}
                        </span>
                      ) : <span className="text-gray-600 text-xs">未分配</span>}
                    </td>
                    <td className="py-2">
                      {p.role && <span className={`text-xs ${p.camp === 'wolf' ? 'text-red-400' : 'text-green-400'}`}>{p.camp === 'wolf' ? '狼人' : '好人'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <RoleAssignmentModal
          show={showRoleAssignment}
          onClose={() => setShowRoleAssignment(false)}
          currentGame={currentGame}
          currentScript={currentScript}
          currentScriptRoles={currentScriptRoles}
          roleAssignments={roleAssignments}
          setRoleAssignments={setRoleAssignments}
          onRandomAssign={handleRandomAssignRoles}
          onAssignRoles={handleAssignRoles}
        />
        {showRoleSelector && (
          <RoleSelector onComplete={handleCreateCustomScript} onCancel={() => setShowRoleSelector(false)} />
        )}
      </div>
    );
  }

  // ============================
  // Running / Finished: main game UI
  // ============================
  const NIGHT_PHASES = ['fear', 'dream', 'gargoyle', 'guard', 'wolf', 'wolf_beauty', 'witch', 'seer', 'gravekeeper'];
  const SHERIFF_PHASES = ['sheriffElection', 'sheriffCampaign', 'sheriffVote'];
  const phase = currentGame.currentPhase;

  // 警长信息
  const sheriff = currentGame.sheriffId > 0 ? currentGame.players.find(p => p.playerId === currentGame.sheriffId) : null;

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-gray-900 via-blue-900/80 to-gray-900 flex flex-col">
      {/* ========== HEADER ========== */}
      <header className="shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-md px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto gap-2">
          {/* Left: Room info + sheriff */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <span className="text-xs text-gray-500 font-mono hidden sm:inline">#{currentGame.roomCode}</span>
            <span className="text-xs text-gray-600 hidden sm:inline">|</span>
            <span className="text-xs text-gray-400 truncate hidden sm:inline">{currentGame.scriptName}</span>
            {/* 警长 — 移动端也显示 */}
            {sheriff && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded-lg shrink-0">
                <span className="text-sm sm:text-base">🎖️</span>
                <span className="text-xs sm:text-sm font-bold text-yellow-300">{currentGame.sheriffId}号</span>
              </span>
            )}
            {currentGame.sheriffBadgeState === 'destroyed' && (
              <span className="text-[11px] text-gray-500 px-1.5 py-0.5 bg-gray-500/10 rounded">警徽已流失</span>
            )}
          </div>

          {/* Center: Current state */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${
              currentGame.currentPhaseType === 'night'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              R{currentGame.currentRound} · {currentGame.currentPhaseType === 'night' ? '夜' : '白天'}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[120px] sm:max-w-none">
              {getPhaseLabel(phase)}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isGameRunning && (
              <>
                <button
                  onClick={handleAdvancePhase}
                  className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold rounded-lg transition shadow-lg shadow-blue-600/20"
                >
                  下一阶段 →
                </button>
                <button
                  onClick={() => { if (confirm('确定要强制结束游戏吗？此操作不可撤回。')) wsService.send({ type: 'GOD_FORCE_END_GAME' }); }}
                  className="px-2 sm:px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 text-[11px] sm:text-xs rounded-lg transition border border-white/10"
                >
                  结束
                </button>
              </>
            )}
            {isGameFinished && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-600/20 text-green-300 border border-green-500/30 font-medium">
                {currentGame.winner === 'wolf' ? '🐺 狼人胜' : '✨ 好人胜'}
              </span>
            )}
            <button onClick={handleLogout}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-gray-500 text-[11px] rounded-lg transition border border-white/10 hidden sm:block">
              退出
            </button>
          </div>
        </div>
      </header>

      {/* ========== MAIN CONTENT ========== */}
      <main className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 p-2 sm:p-3 lg:p-4 max-w-[1600px] mx-auto w-full overflow-hidden">
        {/* ---- Main Stage ---- */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3 overflow-y-auto">
          {/* Phase hint */}
          {getPhaseHint(phase) && (
            <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[11px] sm:text-xs text-gray-400">{getPhaseHint(phase)}</p>
            </div>
          )}

          {/* Progress bar (night only) */}
          {currentGame.currentPhaseType === 'night' && <PhaseProgressBar game={currentGame} />}

          {/* Night death notification */}
          {showDeathNotice && currentGame.currentPhaseType === 'day' && (
            <NightDeathNotification currentGame={currentGame} onDismiss={() => setShowDeathNotice(false)} />
          )}

          {/* Phase-specific panel */}
          <div className="flex-1 min-h-0">
            {(() => {
              if (NIGHT_PHASES.includes(phase)) {
                return <NightActionCards game={currentGame} />;
              }
              if (SHERIFF_PHASES.includes(phase)) {
                return <SheriffElectionPanel currentGame={currentGame} />;
              }
              if (phase === 'vote' || phase === 'voteResult') {
                return <ExileVotePanel currentGame={currentGame} />;
              }
              if (phase === 'discussion') {
                const aliveWolves = currentGame.players.filter(p => p.camp === 'wolf' && p.alive && p.role !== 'wolf_beauty' && p.role !== 'black_wolf' && p.role !== 'gargoyle' && p.role !== 'nightmare');
                const pending = currentGame.pendingSheriffTransfer;
                return (
                  <div className="space-y-3">
                    <div className="p-4 sm:p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <h4 className="text-base sm:text-lg font-bold text-amber-300 mb-2">白天讨论阶段</h4>
                      <p className="text-gray-300 text-xs sm:text-sm">请主持玩家依次发言，发言结束后点击「下一阶段」进行投票。</p>
                      {aliveWolves.length > 0 && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-red-300 text-xs sm:text-sm">
                            狼人可在讨论阶段自爆（{aliveWolves.map(w => `${w.playerId}号`).join('、')}）
                          </p>
                        </div>
                      )}
                    </div>
                    {pending?.reason === 'wolf_explosion' && (
                      <div className="p-4 sm:p-6 bg-red-600/20 rounded-xl border border-red-500">
                        <h4 className="text-base sm:text-lg font-bold text-red-400 mb-2">狼人自爆 - 请指定警徽归属</h4>
                        <p className="text-gray-300 text-xs sm:text-sm mb-4">
                          警长 {pending.fromPlayerId}号自爆，请指定警徽给谁
                        </p>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          {pending.options.map(playerId => {
                            const player = currentGame.players.find(p => p.playerId === playerId);
                            return (
                              <button
                                key={playerId}
                                onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: playerId })}
                                className="p-3 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500 rounded-lg transition"
                              >
                                <div className="text-white font-bold text-sm">{playerId}号</div>
                                <div className="text-gray-300 text-xs">{player?.username}</div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: 'none' })}
                          className="w-full py-2 bg-gray-600/30 hover:bg-gray-600/50 border border-gray-500 text-gray-300 text-sm rounded-lg transition"
                        >
                          不给警徽
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              if (phase === 'settle' || phase === 'daySettle') {
                const unresolvedTriggers = (currentGame.pendingDeathTriggers || []).filter(t => !t.resolved);
                return (
                  <div className="space-y-4">
                    <NightDeathNotification currentGame={currentGame} />
                    {unresolvedTriggers.map(trigger => {
                      const alivePlayers = currentGame.players.filter(p => p.alive && p.playerId !== trigger.actorId);
                      const isHunter = trigger.type === 'hunter_shoot';
                      const label = isHunter ? '猎人开枪' : '黑狼王爆炸';
                      return (
                        <div key={trigger.id} className={`p-4 sm:p-6 rounded-xl border-2 ${isHunter ? 'bg-orange-500/10 border-orange-500' : 'bg-purple-500/10 border-purple-500'}`}>
                          <h4 className={`text-lg font-bold mb-2 ${isHunter ? 'text-orange-300' : 'text-purple-300'}`}>
                            {isHunter ? '🏹' : '💥'} {trigger.actorId}号{label} — 请指定目标
                          </h4>
                          <p className="text-gray-300 text-sm mb-4">{trigger.message}</p>
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            {alivePlayers.map(p => (
                              <button
                                key={p.playerId}
                                onClick={() => wsService.send({ type: 'GOD_RESOLVE_DEATH_TRIGGER', triggerId: trigger.id, targetId: p.playerId })}
                                className={`py-3 text-white font-bold rounded-lg transition border ${isHunter ? 'bg-orange-600/30 hover:bg-orange-600 border-orange-500/50 hover:border-orange-500' : 'bg-purple-600/30 hover:bg-purple-600 border-purple-500/50 hover:border-purple-500'}`}
                              >
                                {p.playerId}号
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => wsService.send({ type: 'GOD_RESOLVE_DEATH_TRIGGER', triggerId: trigger.id, targetId: 'skip' })}
                            className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
                          >
                            {isHunter ? '放弃开枪' : '放弃爆炸'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              if (phase === 'hunter' || phase === 'knight') {
                return (
                  <div className="p-4 sm:p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                    <h4 className="text-base sm:text-lg font-bold text-orange-300 mb-2">{getPhaseLabel(phase)}</h4>
                    <p className="text-gray-300 text-xs sm:text-sm">{getPhaseHint(phase)}</p>
                  </div>
                );
              }
              if (phase === 'finished') {
                return (
                  <div className="p-4 sm:p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                    <h4 className="text-xl sm:text-2xl font-bold text-green-300 mb-2">
                      {currentGame.winner === 'wolf' ? '🐺 狼人阵营获胜' : '✨ 好人阵营获胜'}
                    </h4>
                    <p className="text-gray-300 text-sm">游戏已结束，可通过底部按钮查看复盘或导出数据。</p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* ---- Right Sidebar (desktop only) ---- */}
        <aside className="hidden lg:flex w-60 xl:w-72 shrink-0 flex-col gap-3 overflow-y-auto">
          <RoleStatusPanel game={currentGame} />
          <CampOverviewPanel game={currentGame} />
        </aside>
      </main>

      {/* ========== BOTTOM DOCK ========== */}
      <footer className="shrink-0 border-t border-white/10 bg-black/20 backdrop-blur-md px-2 sm:px-4 lg:px-6 py-1.5 sm:py-2">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {/* 信息面板 — 仅移动端/平板显示 */}
            <button
              className="lg:hidden flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] sm:text-xs rounded-lg transition border border-indigo-500/30"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <span>📊</span> 信息面板
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] sm:text-xs rounded-lg transition border border-white/10"
              onClick={() => setHistoryDrawerOpen(true)}
            >
              <span>📜</span> 回溯
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] sm:text-xs rounded-lg transition border border-white/10"
              onClick={handleOpenReplayViewer}
            >
              <span>📊</span> 复盘
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] sm:text-xs rounded-lg transition border border-white/10"
              onClick={handleExportReplay}
            >
              <span>📥</span> 导出
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] sm:text-xs rounded-lg transition border border-white/10"
              onClick={() => setIsPlayerTableDrawerOpen(true)}
            >
              <span>📋</span> 列表
            </button>
          </div>
          {/* 退出 (mobile) */}
          <button onClick={handleLogout}
            className="sm:hidden px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-500 text-[11px] rounded-lg transition border border-white/10">
            退出
          </button>
        </div>
      </footer>

      {/* ========== OVERLAYS & DRAWERS ========== */}

      {/* Mobile sidebar sheet — 从底部滑出，仅 < lg 时使用 */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out
          max-h-[70vh] bg-gray-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-2xl shadow-2xl
          flex flex-col
          ${mobileSidebarOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10">
          <h3 className="text-sm font-bold text-white">信息面板</h3>
          <button onClick={() => setMobileSidebarOpen(false)} className="text-gray-400 hover:text-white text-lg transition">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <RoleStatusPanel game={currentGame} />
          <CampOverviewPanel game={currentGame} />
        </div>
      </div>

      <HistoryDrawer game={currentGame} open={historyDrawerOpen} onClose={() => setHistoryDrawerOpen(false)} />

      <PlayerTableDrawer
        isOpen={isPlayerTableDrawerOpen}
        onClose={() => setIsPlayerTableDrawerOpen(false)}
        playerStats={calculatePlayerStats(currentGame)}
      />

      <GameReplayViewer
        isOpen={isReplayViewerOpen}
        onClose={() => setIsReplayViewerOpen(false)}
        replayData={replayData}
      />

      {showTransition && transitionInfo && (
        <PhaseTransitionOverlay
          phase={transitionInfo.phase}
          phaseType={transitionInfo.phaseType}
          prompt={transitionInfo.prompt}
          visible={showTransition}
          onDismiss={() => setShowTransition(false)}
        />
      )}
    </div>
  );
}
