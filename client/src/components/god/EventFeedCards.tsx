/**
 * EventFeedCards — 事件流子组件集合
 * 用于 EventFeedPanel，渲染各类事件卡片和交互操作
 */

import type { Game, GameEvent, PendingDeathTrigger, PendingSheriffTransfer } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';
import { getRoleName } from '../../utils/phaseLabels';

// ============================================
// 1. EventCard — 只读事件卡片
// ============================================

export function EventCard({ event }: { event: GameEvent }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1">
      <span className="w-6 text-center text-sm flex-shrink-0 leading-5">{event.icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-gray-200">{event.text}</span>
        {event.details && (
          <span className="ml-1.5 text-[11px] text-gray-500">{event.details}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// 2. SectionHeader — 区段分隔头
// ============================================

export function SectionHeader({ icon, label, className }: { icon: string; label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 pt-3 pb-1 px-2 ${className || ''}`}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-bold text-white whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ============================================
// 3. NightActionProgressCard — 夜间操作进度网格
// ============================================

interface NightRoleConfig {
  key: string;          // NightActionsState 的 submitted 字段前缀
  phaseKey: string;     // 对应 game.currentPhase 值
  roles: string[];      // 对应角色 id 列表
  label: string;
  icon: string;
}

const NIGHT_ROLE_CONFIGS: NightRoleConfig[] = [
  { key: 'fear',        phaseKey: 'fear',        roles: ['nightmare'],                        label: '噩梦之影', icon: '🌙' },
  { key: 'dream',       phaseKey: 'dream',       roles: ['dreamer'],                          label: '摄梦人',   icon: '💤' },
  { key: 'gargoyle',    phaseKey: 'gargoyle',     roles: ['gargoyle'],                         label: '石像鬼',   icon: '🗿' },
  { key: 'guard',       phaseKey: 'guard',        roles: ['guard'],                            label: '守卫',     icon: '🛡️' },
  { key: 'wolf',        phaseKey: 'wolf',         roles: ['wolf', 'white_wolf', 'black_wolf'], label: '狼人',     icon: '🐺' },
  { key: 'wolfBeauty',  phaseKey: 'wolf_beauty',  roles: ['wolf_beauty'],                      label: '狼美人',   icon: '💃' },
  { key: 'witch',       phaseKey: 'witch',        roles: ['witch'],                            label: '女巫',     icon: '🧪' },
  { key: 'seer',        phaseKey: 'seer',         roles: ['seer'],                             label: '预言家',   icon: '🔮' },
  { key: 'gravekeeper', phaseKey: 'gravekeeper',  roles: ['gravekeeper'],                      label: '守墓人',   icon: '⚰️' },
];

export function NightActionProgressCard({ game }: { game: Game }) {
  const na = game.nightActions;
  const allRoles = new Set(game.players.map(p => p.role));
  const aliveRoles = new Set(game.players.filter(p => p.alive).map(p => p.role));

  // 显示本局所有角色（包括已死亡的），避免通过缺失阶段泄露信息
  const visibleConfigs = NIGHT_ROLE_CONFIGS.filter(cfg =>
    cfg.roles.some(r => allRoles.has(r))
  );

  if (visibleConfigs.length === 0) return null;

  return (
    <div className="mx-2 p-3 rounded-xl border border-white/5 bg-white/5">
      <div className="text-[11px] text-gray-400 mb-2 font-medium">夜间行动进度</div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
        {visibleConfigs.map(cfg => {
          const submittedKey = `${cfg.key}Submitted` as keyof typeof na;
          const submitted = !!na[submittedKey];
          const isCurrent = game.currentPhase === cfg.phaseKey;
          const isRoleDead = cfg.roles.some(r => allRoles.has(r)) && !cfg.roles.some(r => aliveRoles.has(r));
          const isDeadPhase = isCurrent && game.currentPhaseDeadPlayer;

          let statusIcon: string;
          let statusColor: string;
          if (submitted) {
            statusIcon = '✓';
            statusColor = 'text-green-400';
          } else if (isDeadPhase) {
            statusIcon = '✗';
            statusColor = 'text-red-400';
          } else if (isCurrent) {
            statusIcon = '◉';
            statusColor = 'text-yellow-400';
          } else if (isRoleDead) {
            statusIcon = '✗';
            statusColor = 'text-red-400/50';
          } else {
            statusIcon = '·';
            statusColor = 'text-gray-600';
          }

          return (
            <div
              key={cfg.key}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all ${
                isDeadPhase
                  ? 'bg-red-500/10 border-red-500/30'
                  : isCurrent
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-white/5 border-white/5'
              }`}
            >
              <span className={`text-xs ${isRoleDead ? 'opacity-50' : ''}`}>{cfg.icon}</span>
              <span className={`text-[11px] truncate flex-1 ${isRoleDead ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{cfg.label}</span>
              <span className={`text-xs font-bold ${statusColor}`}>{statusIcon}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 3.5. DeadPlayerPhaseCard — 死亡角色阶段提示卡片
// ============================================

export function DeadPlayerPhaseCard({ game }: { game: Game }) {
  const handleConfirmAdvance = () => {
    wsService.send({ type: 'GOD_ADVANCE_PHASE' });
  };

  // 找到当前阶段对应的角色配置
  const currentConfig = NIGHT_ROLE_CONFIGS.find(cfg => cfg.phaseKey === game.currentPhase);

  return (
    <div className="mx-2 p-3 rounded-xl border-2 bg-red-500/10 border-red-500/40">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">💀</span>
        <span className="text-sm font-bold text-red-400">
          {currentConfig ? currentConfig.label : game.currentPhase} — 已阵亡
        </span>
      </div>
      <div className="text-[11px] text-gray-400 mb-2">
        该角色已死亡，阶段保留以防止信息泄露。请假装操作后点击确认推进。
      </div>
      <button
        onClick={handleConfirmAdvance}
        className="w-full py-2 text-xs font-bold rounded-lg transition border bg-red-600/30 hover:bg-red-600/50 border-red-500/50 text-red-300"
      >
        确认推进 →
      </button>
    </div>
  );
}

// ============================================
// 4. DeathTriggerCard — 死亡触发交互卡片
// ============================================

export function DeathTriggerCard({ trigger, game }: { trigger: PendingDeathTrigger; game: Game }) {
  const isHunter = trigger.type === 'hunter_shoot';
  const themeColor = isHunter ? 'orange' : 'purple';
  const themeBg = isHunter ? 'bg-orange-500/10' : 'bg-purple-500/10';
  const themeBorder = isHunter ? 'border-orange-500/50' : 'border-purple-500/50';
  const themeText = isHunter ? 'text-orange-400' : 'text-purple-400';
  const themeBtnBg = isHunter ? 'bg-orange-600/30 hover:bg-orange-600/50 border-orange-500/50' : 'bg-purple-600/30 hover:bg-purple-600/50 border-purple-500/50';

  const alivePlayers = game.players.filter(p => p.alive && p.playerId !== trigger.actorId);

  const handleSelect = (playerId: number) => {
    wsService.send({ type: 'GOD_RESOLVE_DEATH_TRIGGER', triggerId: trigger.id, targetId: playerId });
  };

  const handleSkip = () => {
    wsService.send({ type: 'GOD_RESOLVE_DEATH_TRIGGER', triggerId: trigger.id, targetId: 'skip' });
  };

  return (
    <div className={`mx-2 p-3 rounded-xl border-2 ${themeBg} ${themeBorder}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{isHunter ? '🏹' : '💥'}</span>
        <span className={`text-sm font-bold ${themeText}`}>
          {isHunter ? '猎人开枪' : '黑狼王爆炸'} — {trigger.actorId}号
        </span>
      </div>
      <div className="text-[11px] text-gray-400 mb-2">{trigger.message}</div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {alivePlayers.map(p => (
          <button
            key={p.playerId}
            onClick={() => handleSelect(p.playerId)}
            className={`py-2 text-xs font-bold rounded-lg transition border ${themeBtnBg} text-white`}
          >
            {p.playerId}号
          </button>
        ))}
      </div>
      <button
        onClick={handleSkip}
        className="w-full py-2 text-xs font-bold rounded-lg transition border bg-gray-600/30 hover:bg-gray-600/50 border-gray-500/50 text-gray-400"
      >
        跳过（不指定目标）
      </button>
    </div>
  );
}

// ============================================
// 5. SheriffAssignCard — 指定警长交互卡片
// ============================================

export function SheriffAssignCard({ transfer, game }: { transfer: PendingSheriffTransfer; game: Game }) {
  const handleAssign = (playerId: number) => {
    wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: playerId });
  };

  const handleNoAssign = () => {
    wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: 'none' });
  };

  const reasonLabel = transfer.reason === 'death'
    ? '警长死亡'
    : transfer.reason === 'wolf_explosion'
      ? '狼人自爆'
      : '平票';

  return (
    <div className="mx-2 p-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🎖️</span>
        <span className="text-sm font-bold text-yellow-400">
          指定警长 — {reasonLabel}
        </span>
      </div>
      <div className="text-[11px] text-gray-400 mb-2">
        {transfer.fromPlayerId}号的警徽需要转移，请指定新警长
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {transfer.options.map(playerId => {
          const p = game.players.find(pl => pl.playerId === playerId);
          return (
            <button
              key={playerId}
              onClick={() => handleAssign(playerId)}
              className="py-2 text-xs font-bold rounded-lg transition border bg-yellow-600/30 hover:bg-yellow-600/50 border-yellow-500/50 text-white"
            >
              <div>{playerId}号</div>
              {p && <div className="text-[10px] text-yellow-200/60 font-normal">{p.username}</div>}
            </button>
          );
        })}
      </div>
      <button
        onClick={handleNoAssign}
        className="w-full py-2 text-xs font-bold rounded-lg transition border bg-gray-600/30 hover:bg-gray-600/50 border-gray-500/50 text-gray-400"
      >
        不给警徽
      </button>
    </div>
  );
}

// ============================================
// 6. SheriffElectionLiveCard — 警长竞选实时卡片
// ============================================

export function SheriffElectionLiveCard({ game }: { game: Game }) {
  const election = game.sheriffElection;
  if (!election) return null;

  const { phase, candidates, withdrawn, votes, voteTally, result, tiedPlayers } = election;

  // 辅助: 获取玩家名
  const playerName = (id: number) => {
    const p = game.players.find(pl => pl.playerId === id);
    return p ? p.username : '';
  };

  // signup: 上警阶段
  if (phase === 'signup') {
    const decided = game.players.filter(p => p.alive && p.sheriffCandidate !== undefined);
    const pending = game.players.filter(p => p.alive && p.sheriffCandidate === undefined);
    const notRunning = game.players.filter(p => p.alive && p.sheriffCandidate === false);

    return (
      <div className="mx-2 p-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🎖️</span>
          <span className="text-sm font-bold text-yellow-400">警长竞选 — 上警阶段</span>
          <span className="ml-auto text-[11px] text-gray-500">
            {decided.length}/{game.players.filter(p => p.alive).length} 已选择
          </span>
        </div>
        <div className="space-y-1 mb-2">
          {candidates.length > 0 && (
            <div className="text-[11px]">
              <span className="text-yellow-400 font-bold">上警: </span>
              <span className="text-gray-200">
                {candidates.map(id => `${id}号`).join('、')}
              </span>
            </div>
          )}
          {notRunning.length > 0 && (
            <div className="text-[11px]">
              <span className="text-gray-500 font-bold">不上警: </span>
              <span className="text-gray-500">
                {notRunning.map(p => `${p.playerId}号`).join('、')}
              </span>
            </div>
          )}
          {pending.length > 0 && (
            <div className="text-[11px]">
              <span className="text-orange-400 font-bold">未选择: </span>
              <span className="text-orange-300">
                {pending.map(p => `${p.playerId}号`).join('、')}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => wsService.send({ type: 'GOD_SHERIFF_START_CAMPAIGN' })}
          className="w-full py-2 text-xs font-bold rounded-lg transition border bg-yellow-600 hover:bg-yellow-500 border-yellow-500 text-white"
        >
          结束上警，进入发言
        </button>
      </div>
    );
  }

  // campaign: 发言阶段
  if (phase === 'campaign') {
    return (
      <div className="mx-2 p-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🗣️</span>
          <span className="text-sm font-bold text-yellow-400">警长竞选 — 发言阶段</span>
        </div>
        <div className="space-y-1 mb-2">
          <div className="text-[11px]">
            <span className="text-yellow-400 font-bold">候选人 ({candidates.length}): </span>
            <span className="text-gray-200">
              {candidates.map(id => `${id}号 ${playerName(id)}`).join('、')}
            </span>
          </div>
          {withdrawn.length > 0 && (
            <div className="text-[11px]">
              <span className="text-gray-500 font-bold">已退水 ({withdrawn.length}): </span>
              <span className="text-gray-500 line-through">
                {withdrawn.map(id => `${id}号`).join('、')}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => wsService.send({ type: 'GOD_SHERIFF_START_VOTING' })}
          className="w-full py-2 text-xs font-bold rounded-lg transition border bg-yellow-600 hover:bg-yellow-500 border-yellow-500 text-white"
        >
          结束发言，进入投票
        </button>
      </div>
    );
  }

  // voting: 投票阶段
  if (phase === 'voting') {
    const eligibleVoters = game.players.filter(
      p => p.alive && !candidates.includes(p.playerId) && !withdrawn.includes(p.playerId)
    );
    const votedCount = Object.keys(votes).length;

    return (
      <div className="mx-2 p-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🗳️</span>
          <span className="text-sm font-bold text-yellow-400">警长竞选 — 投票阶段</span>
          <span className="ml-auto text-[11px] text-gray-400">
            {votedCount}/{eligibleVoters.length}
          </span>
        </div>
        {/* 各候选人得票 */}
        {votedCount > 0 && (
          <div className="space-y-1 mb-2">
            {candidates.map(cid => {
              const count = Object.values(votes).filter(v => v === cid).length;
              return (
                <div key={cid} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-200">{cid}号 {playerName(cid)}</span>
                  <span className="text-yellow-400 font-bold">{count} 票</span>
                </div>
              );
            })}
            {(() => {
              const skipCount = Object.values(votes).filter(v => v === 'skip').length;
              return skipCount > 0 ? (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">弃票</span>
                  <span className="text-gray-400">{skipCount}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}
        <button
          onClick={() => wsService.send({ type: 'GOD_SHERIFF_TALLY_VOTES' })}
          className="w-full py-2 text-xs font-bold rounded-lg transition border bg-gray-600 hover:bg-gray-500 border-gray-500 text-white"
        >
          结束投票，统计结果
        </button>
      </div>
    );
  }

  // tie: 平票 — 由上帝指定
  if (phase === 'tie' && tiedPlayers && tiedPlayers.length > 0) {
    return (
      <div className="mx-2 p-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">⚖️</span>
          <span className="text-sm font-bold text-yellow-400">警长竞选 — 平票</span>
        </div>
        {/* 显示计票结果 */}
        {voteTally && (
          <div className="space-y-1 mb-2">
            {candidates.map(cid => {
              const weightedVotes = voteTally[cid] || 0;
              const isTied = tiedPlayers.includes(cid);
              return (
                <div key={cid} className="flex items-center justify-between text-[11px]">
                  <span className={isTied ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                    {cid}号 {playerName(cid)} {isTied ? '(平票)' : ''}
                  </span>
                  <span className={isTied ? 'text-yellow-400 font-bold' : 'text-gray-400'}>
                    {weightedVotes} 票
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-[11px] text-gray-400 mb-2">
          平票玩家: {tiedPlayers.map(id => `${id}号`).join('、')}，请指定警长
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {tiedPlayers.map(playerId => (
            <button
              key={playerId}
              onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: playerId })}
              className="py-2 text-xs font-bold rounded-lg transition border bg-yellow-600/30 hover:bg-yellow-600/50 border-yellow-500/50 text-white"
            >
              {playerId}号
            </button>
          ))}
        </div>
        <button
          onClick={() => wsService.send({ type: 'GOD_ASSIGN_SHERIFF', targetId: 'none' })}
          className="w-full py-2 text-xs font-bold rounded-lg transition border bg-gray-600/30 hover:bg-gray-600/50 border-gray-500/50 text-gray-400"
        >
          警徽流失
        </button>
      </div>
    );
  }

  // done: 结果只读
  if (phase === 'done') {
    const winner = result ? game.players.find(p => p.playerId === result) : null;
    return (
      <div className="mx-2 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎖️</span>
          <span className="text-xs text-gray-200">
            {winner
              ? `${result}号 ${winner.username} 当选警长`
              : '无人当选警长'
            }
          </span>
          {voteTally && (
            <span className="ml-auto text-[11px] text-gray-500">
              {candidates.map(id => `${id}号:${voteTally[id] || 0}票`).join(' / ')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================
// 7. ExileVoteLiveCard — 放逐投票实时卡片
// ============================================

export function ExileVoteLiveCard({ game }: { game: Game }) {
  const ev = game.exileVote;
  if (!ev) return null;

  const { phase: evPhase, votes: evVotes, result: evResult, pkPlayers, pkVotes } = ev;

  // 辅助: 按目标聚合投票
  const aggregateVotes = (voteMap: { [voterId: number]: number | 'skip' }) => {
    const tally: { [target: string]: number[] } = {};
    for (const [voterId, targetId] of Object.entries(voteMap)) {
      const key = targetId === 'skip' ? 'skip' : String(targetId);
      if (!tally[key]) tally[key] = [];
      tally[key].push(Number(voterId));
    }
    return tally;
  };

  // voting / pk 阶段
  if (evPhase === 'voting' || evPhase === 'pk') {
    const activeVotes = evPhase === 'pk' && pkVotes ? pkVotes : evVotes;
    const votedCount = Object.keys(activeVotes).length;
    const tally = aggregateVotes(activeVotes);

    return (
      <div className="mx-2 p-3 rounded-xl border-2 bg-orange-500/10 border-orange-500/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🗳️</span>
          <span className="text-sm font-bold text-orange-400">
            放逐投票 — {evPhase === 'pk' ? '平票PK' : '投票中'}
          </span>
          <span className="ml-auto text-[11px] text-gray-400">{votedCount} 人已投</span>
        </div>
        {/* PK 玩家 */}
        {evPhase === 'pk' && pkPlayers && (
          <div className="text-[11px] text-orange-300 mb-1.5">
            PK玩家: {pkPlayers.map(id => `${id}号`).join('、')}
          </div>
        )}
        {/* 投票明细 */}
        {votedCount > 0 && (
          <div className="space-y-0.5 mb-1">
            {Object.entries(tally)
              .sort((a, b) => {
                if (a[0] === 'skip') return 1;
                if (b[0] === 'skip') return -1;
                return b[1].length - a[1].length;
              })
              .map(([target, voters]) => (
                <div key={target} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-300">
                    {target === 'skip' ? '弃票' : `${target}号`}
                    <span className="text-gray-500 ml-1">
                      ← {voters.sort((a, b) => a - b).map(v => `${v}号`).join('、')}
                    </span>
                  </span>
                  <span className="text-orange-400 font-bold">{voters.length} 票</span>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }

  // done: 结果
  if (evPhase === 'done') {
    let resultText: string;
    if (evResult === 'none') {
      resultText = '本轮无人被放逐';
    } else if (evResult === 'tie') {
      resultText = '投票平票';
    } else {
      const exiled = game.players.find(p => p.playerId === evResult);
      resultText = `${evResult}号${exiled ? ' ' + exiled.username : ''} 被放逐`;
    }
    return (
      <div className="mx-2 p-3 rounded-xl border border-orange-500/30 bg-orange-500/5">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚖️</span>
          <span className="text-xs text-gray-200">{resultText}</span>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================
// 8. DiscussionCard — 讨论阶段提示卡片
// ============================================

// 不可自爆的狼阵营角色
const NON_BOOM_WOLF_ROLES = new Set(['wolf_beauty', 'gargoyle', 'nightmare']);

export function DiscussionCard({ game }: { game: Game }) {
  // 可自爆的狼人: 存活的狼阵营玩家中排除 wolf_beauty、gargoyle、nightmare
  const boomableWolves = game.players.filter(
    p => p.alive && p.camp === 'wolf' && !NON_BOOM_WOLF_ROLES.has(p.role)
  );

  return (
    <div className="mx-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">💬</span>
        <span className="text-sm font-bold text-amber-400">讨论阶段</span>
      </div>
      {/* 可自爆狼人列表 */}
      {boomableWolves.length > 0 && !game.skipToNight && (
        <div className="text-[11px] text-gray-400">
          可自爆: {boomableWolves.map(p => `${p.playerId}号 ${getRoleName(p.role)}`).join('、')}
        </div>
      )}
      {/* 自爆提示 */}
      {game.skipToNight && (
        <div className="mt-1.5 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-[11px] text-red-400 font-bold">
          狼人已自爆，将跳过投票直接进入夜晚
        </div>
      )}
    </div>
  );
}

// ============================================
// 9. GameFinishedCard — 游戏结束卡片
// ============================================

export function GameFinishedCard({ game }: { game: Game }) {
  const isWolfWin = game.winner === 'wolf';
  return (
    <div className="mx-2 p-3 rounded-xl border-2 border-green-500/50 bg-green-500/10">
      <div className="flex items-center gap-2">
        <span className="text-sm">🏁</span>
        <span className="text-sm font-bold text-green-400">游戏结束</span>
      </div>
      <div className="mt-1 text-xs text-gray-200">
        {isWolfWin ? '🐺 狼人阵营获胜' : '🛡️ 好人阵营获胜'}
      </div>
    </div>
  );
}
