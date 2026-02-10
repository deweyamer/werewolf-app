import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GamePhase, ClientMessage } from '../../../shared/src/types';
import { ROLE_INFO } from '../../../shared/src/constants';
import { wsService } from '../services/websocket';
import RoleActionPanel from '../components/RoleActionPanel';
import {
  ROLE_PHASE_MAP,
  ROLE_ABILITY_CONTROLS,
  createSandboxState,
  getDefaultAbilities,
} from '../utils/devMockData';

interface LogEntry {
  id: number;
  time: string;
  source: 'callback' | 'wsService';
  message: any;
}

// 所有可用阶段（用于阶段选择器）
const ALL_PHASES: { value: GamePhase; label: string }[] = [
  { value: 'fear', label: '恐惧' },
  { value: 'dream', label: '梦游' },
  { value: 'gargoyle', label: '石像鬼' },
  { value: 'guard', label: '守卫' },
  { value: 'wolf', label: '狼人' },
  { value: 'wolf_beauty', label: '狼美人' },
  { value: 'witch', label: '女巫' },
  { value: 'seer', label: '预言家' },
  { value: 'gravekeeper', label: '守墓人' },
  { value: 'settle', label: '结算' },
  { value: 'discussion', label: '讨论' },
  { value: 'vote', label: '投票' },
  { value: 'hunter', label: '猎人' },
  { value: 'knight', label: '骑士' },
];

// 按阵营分组角色
const ROLE_GROUPS = [
  {
    label: '狼人阵营',
    roles: Object.values(ROLE_INFO).filter((r) => r.camp === 'wolf'),
  },
  {
    label: '神职（好人）',
    roles: Object.values(ROLE_INFO).filter((r) => r.type === 'god'),
  },
  {
    label: '平民',
    roles: Object.values(ROLE_INFO).filter((r) => r.type === 'civilian'),
  },
];

export default function DevRoleSandbox() {
  // 控制状态
  const [selectedRole, setSelectedRole] = useState('wolf');
  const [phaseOverride, setPhaseOverride] = useState<GamePhase>('wolf');
  const [deadPlayers, setDeadPlayers] = useState<Set<number>>(new Set());
  const [abilityOverrides, setAbilityOverrides] = useState<Record<string, any>>({});

  // RoleActionPanel 状态
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [witchAction, setWitchAction] = useState<'none' | 'antidote' | 'poison'>('none');
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [poisonTarget, setPoisonTarget] = useState(0);

  // 操作日志
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);

  // 从 abilityOverrides 中提取 nightActions 字段
  const witchKnowsVictim = abilityOverrides['witchKnowsVictim'] || 0;

  // 构造 abilities（排除 nightActions 字段）
  const abilities = useMemo(() => {
    const defaults = getDefaultAbilities(selectedRole);
    const controls = ROLE_ABILITY_CONTROLS[selectedRole] || [];
    const result = { ...defaults };
    for (const ctrl of controls) {
      if (!ctrl.isNightAction && abilityOverrides[ctrl.key] !== undefined) {
        result[ctrl.key] = abilityOverrides[ctrl.key];
      }
    }
    return result;
  }, [selectedRole, abilityOverrides]);

  // 生成 mock 游戏状态
  const { game, myPlayer } = useMemo(
    () =>
      createSandboxState(selectedRole, {
        phase: phaseOverride,
        deadPlayers,
        abilities,
        witchKnowsVictim: witchKnowsVictim || undefined,
      }),
    [selectedRole, phaseOverride, deadPlayers, abilities, witchKnowsVictim]
  );

  // Monkey-patch wsService.send 拦截 RoleActionPanel 内部的直接调用
  useEffect(() => {
    const originalSend = wsService.send.bind(wsService);
    wsService.send = (message: ClientMessage) => {
      setActionLog((prev) => [
        ...prev,
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString('zh-CN'),
          source: 'wsService',
          message,
        },
      ]);
    };
    return () => {
      wsService.send = originalSend;
    };
  }, []);

  // 添加日志
  const addLog = useCallback((source: 'callback' | 'wsService', message: any) => {
    setActionLog((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString('zh-CN'),
        source,
        message,
      },
    ]);
  }, []);

  // 回调函数
  const handleSubmitAction = useCallback(() => {
    addLog('callback', {
      type: 'PLAYER_SUBMIT_ACTION',
      action: {
        phase: phaseOverride,
        playerId: 1,
        actionType: 'action',
        target: selectedTarget,
      },
    });
    setSelectedTarget(0);
  }, [phaseOverride, selectedTarget, addLog]);

  const handleWitchSubmit = useCallback((
    actionOverride?: 'save' | 'poison' | 'none',
    targetOverride?: number
  ) => {
    const actionType = actionOverride ?? 'none';
    const target = targetOverride ?? (actionType === 'save' ? witchKnowsVictim : 0);
    addLog('callback', {
      type: 'PLAYER_SUBMIT_ACTION',
      action: {
        phase: 'witch',
        playerId: 1,
        actionType,
        target,
      },
    });
    setWitchAction('none');
    setPoisonTarget(0);
    setShowPoisonModal(false);
  }, [witchKnowsVictim, addLog]);

  // 角色切换时重置状态
  const handleRoleChange = useCallback((roleId: string) => {
    setSelectedRole(roleId);
    setPhaseOverride(ROLE_PHASE_MAP[roleId] || 'wolf');
    setAbilityOverrides({});
    setSelectedTarget(0);
    setWitchAction('none');
    setShowPoisonModal(false);
    setPoisonTarget(0);
    setDeadPlayers(new Set());
  }, []);

  // 切换玩家存活状态
  const togglePlayerDead = useCallback((playerId: number) => {
    setDeadPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }, []);

  // 更新技能控制值
  const updateAbility = useCallback((key: string, value: any) => {
    setAbilityOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const controls = ROLE_ABILITY_CONTROLS[selectedRole] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 顶栏 */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/admin"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm"
          >
            &larr; 返回管理台
          </Link>
          <h1 className="text-2xl font-bold text-white">角色 UI 开发沙盒</h1>
          <span className="text-yellow-400 text-sm bg-yellow-400/10 px-3 py-1 rounded-full">
            DEV ONLY
          </span>
        </div>

        {/* 主内容：左控制 + 右渲染 */}
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧控制面板 */}
          <div className="col-span-4 space-y-4">
            {/* 角色选择器 */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
              <h3 className="text-white font-bold mb-3">角色选择</h3>
              <select
                value={selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white"
              >
                {ROLE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}（{role.id}）
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="mt-3 text-gray-400 text-sm">
                <p>阵营: {ROLE_INFO[selectedRole]?.camp === 'wolf' ? '狼人' : '好人'}</p>
                <p>类型: {ROLE_INFO[selectedRole]?.type === 'wolf' ? '狼人' : ROLE_INFO[selectedRole]?.type === 'god' ? '神职' : '平民'}</p>
                <p className="mt-1">{ROLE_INFO[selectedRole]?.description}</p>
              </div>
            </div>

            {/* 阶段选择器 */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
              <h3 className="text-white font-bold mb-3">阶段覆盖</h3>
              <select
                value={phaseOverride}
                onChange={(e) => setPhaseOverride(e.target.value as GamePhase)}
                className="w-full px-3 py-2 bg-gray-800 border border-white/20 rounded-lg text-white"
              >
                {ALL_PHASES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}（{p.value}）
                    {p.value === ROLE_PHASE_MAP[selectedRole] ? ' *默认' : ''}
                  </option>
                ))}
              </select>
              <p className="text-gray-500 text-xs mt-2">
                切换阶段可测试该角色在非专属阶段的显示（如等待画面）
              </p>
            </div>

            {/* 技能状态控制 */}
            {controls.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                <h3 className="text-white font-bold mb-3">技能状态</h3>
                <div className="space-y-3">
                  {controls.map((ctrl) => (
                    <div key={ctrl.key} className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">{ctrl.label}</span>
                      {ctrl.type === 'toggle' ? (
                        <button
                          onClick={() =>
                            updateAbility(
                              ctrl.key,
                              abilityOverrides[ctrl.key] !== undefined
                                ? !abilityOverrides[ctrl.key]
                                : !(getDefaultAbilities(selectedRole)[ctrl.key] ?? true)
                            )
                          }
                          className={`px-3 py-1 rounded text-sm font-medium transition ${
                            (abilityOverrides[ctrl.key] ?? getDefaultAbilities(selectedRole)[ctrl.key] ?? true)
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {(abilityOverrides[ctrl.key] ?? getDefaultAbilities(selectedRole)[ctrl.key] ?? true)
                            ? '可用'
                            : '已用'}
                        </button>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={12}
                          value={abilityOverrides[ctrl.key] ?? 0}
                          onChange={(e) => updateAbility(ctrl.key, Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-gray-800 border border-white/20 rounded text-white text-sm text-center"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 玩家存活控制 */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
              <h3 className="text-white font-bold mb-3">
                玩家存活状态
                <span className="text-gray-500 text-xs ml-2">点击切换</span>
              </h3>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((id) => (
                  <button
                    key={id}
                    onClick={() => togglePlayerDead(id)}
                    className={`py-2 rounded text-sm font-bold transition ${
                      id === 1
                        ? deadPlayers.has(id)
                          ? 'bg-red-800 text-red-300 ring-2 ring-yellow-400'
                          : 'bg-blue-600 text-white ring-2 ring-yellow-400'
                        : deadPlayers.has(id)
                          ? 'bg-red-800/50 text-red-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {id}号
                  </button>
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-blue-400">蓝框 = 你（1号）</span>
                <span className="text-red-400">红色 = 已死亡</span>
              </div>
            </div>
          </div>

          {/* 右侧：RoleActionPanel 渲染区 */}
          <div className="col-span-8">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-white/10 min-h-[400px]">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-gray-500 text-sm">
                  当前渲染: {ROLE_INFO[selectedRole]?.name} / {phaseOverride} 阶段
                </span>
                {myPlayer.alive ? (
                  <span className="text-green-400 text-xs bg-green-400/10 px-2 py-0.5 rounded">存活</span>
                ) : (
                  <span className="text-red-400 text-xs bg-red-400/10 px-2 py-0.5 rounded">已死亡</span>
                )}
              </div>
              <RoleActionPanel
                myPlayer={myPlayer}
                currentGame={game}
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
                isSubmitting={false}
              />
            </div>

            {/* 操作日志 */}
            <div className="mt-4 bg-gray-950 rounded-xl p-5 border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white font-bold">操作日志</h3>
                <button
                  onClick={() => setActionLog([])}
                  className="text-gray-500 hover:text-gray-300 text-sm transition"
                >
                  清除
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto font-mono text-sm space-y-2">
                {actionLog.length === 0 ? (
                  <p className="text-gray-600">暂无操作记录。提交或跳过操作后，日志将显示在此处。</p>
                ) : (
                  actionLog.map((entry) => (
                    <div key={entry.id} className="text-gray-300">
                      <span className="text-gray-500">[{entry.time}]</span>{' '}
                      <span className={entry.source === 'wsService' ? 'text-yellow-400' : 'text-blue-400'}>
                        [{entry.source}]
                      </span>{' '}
                      <span className="text-green-400">{entry.message?.type || entry.message?.action?.actionType}</span>
                      <pre className="text-gray-500 ml-4 text-xs whitespace-pre-wrap">
                        {JSON.stringify(entry.message, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
