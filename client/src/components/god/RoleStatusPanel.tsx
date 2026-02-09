import { useState } from 'react';
import { ROLE_INFO } from '../../../../shared/src/constants';
import { getRoleName } from '../../utils/phaseLabels';
import type { Game, GamePlayer } from '../../../../shared/src/types';

const ROLE_ICONS: Record<string, string> = {
  seer: '🔮', witch: '🧪', guard: '🛡️', hunter: '🏹', dreamer: '💤',
  knight: '⚔️', gravekeeper: '⚰️', nightmare: '🌙', wolf: '🐺',
  wolf_beauty: '💃', gargoyle: '🗿', white_wolf: '🐺', black_wolf: '🐺',
};

const WOLF_ROLES = ['wolf', 'nightmare', 'wolf_beauty', 'gargoyle', 'white_wolf', 'black_wolf'];

/** 神职技能概览面板 — 只显示本局存在的角色（非平民） */
export default function RoleStatusPanel({ game }: { game: Game }) {
  const rolePlayerMap = new Map<string, GamePlayer[]>();
  game.players.forEach(p => {
    if (p.role === 'villager') return;
    if (!rolePlayerMap.has(p.role)) rolePlayerMap.set(p.role, []);
    rolePlayerMap.get(p.role)!.push(p);
  });

  const seerChecks = game.history.filter(h => h.action === 'seer_check').map(h => ({
    round: h.round, target: h.target, result: h.result,
  }));
  const witchActions = game.history.filter(h => h.action.startsWith('witch_'));

  const [expanded, setExpanded] = useState<string | null>(null);

  interface RoleEntry {
    role: string;
    icon: string;
    players: GamePlayer[];
    statusLine: string;
    details?: string[];
    isActing: boolean;
  }

  const roleEntries: RoleEntry[] = [];
  const currentPhase = game.currentPhase;

  rolePlayerMap.forEach((players, role) => {
    const p = players[0];
    const icon = ROLE_ICONS[role] || '❓';
    let statusLine = '';
    const details: string[] = [];
    const isActing = currentPhase === role || (currentPhase === 'wolf' && (role === 'wolf' || role === 'nightmare'));

    if (role === 'seer') {
      statusLine = p.alive ? `${p.playerId}号 · 已查${seerChecks.length}人` : `${p.playerId}号 · 已出局`;
      seerChecks.forEach(c => details.push(`R${c.round}: ${c.target}号 → ${c.result.includes('狼人') ? '狼人' : '好人'}`));
    } else if (role === 'witch') {
      const hasAntidote = p.abilities.antidote !== false;
      const hasPoison = p.abilities.poison !== false;
      statusLine = `${p.playerId}号 · 解药:${hasAntidote ? '有' : '已用'} 毒药:${hasPoison ? '有' : '已用'}`;
      witchActions.forEach(a => details.push(`R${a.round}: ${a.result}`));
    } else if (role === 'guard') {
      const lastTarget = p.abilities.lastGuardTarget;
      const currTarget = game.nightActions.guardTarget;
      statusLine = `${p.playerId}号 · 昨晚守${lastTarget || '-'}号${currTarget ? ` · 今晚守${currTarget}号` : ''}`;
    } else if (role === 'hunter') {
      const isPoisoned = p.outReason === 'poison';
      statusLine = `${p.playerId}号 · ${!p.alive ? (isPoisoned ? '被毒·不可开枪' : '已出局') : '可开枪'}`;
    } else if (role === 'dreamer') {
      const lastTarget = p.abilities.lastDreamTarget;
      const ready = p.abilities.dreamKillReady;
      statusLine = `${p.playerId}号 · 上晚梦游${lastTarget || '-'}号${ready ? ' · 连续!' : ''}`;
    } else if (role === 'knight') {
      statusLine = `${p.playerId}号 · 决斗:${p.abilities.knightDuelUsed ? '已用' : '未用'}`;
    } else if (WOLF_ROLES.includes(role)) {
      const aliveWolves = players.filter(pl => pl.alive);
      statusLine = `${players.map(pl => `${pl.playerId}号${pl.alive ? '' : '†'}`).join(' ')} · ${aliveWolves.length}存活`;
    } else {
      statusLine = `${p.playerId}号${p.alive ? '' : ' · 已出局'}`;
    }

    roleEntries.push({ role, icon, players, statusLine, details: details.length > 0 ? details : undefined, isActing });
  });

  const wolfEntries = roleEntries.filter(e => WOLF_ROLES.includes(e.role));
  const goodEntries = roleEntries.filter(e => !WOLF_ROLES.includes(e.role));

  const renderEntry = (entry: RoleEntry, isWolf: boolean) => (
    <button
      key={entry.role}
      className={`w-full text-left px-3 py-2 hover:bg-white/5 transition-all ${
        entry.isActing ? 'bg-yellow-500/10 border-l-2 border-yellow-400' : ''
      } ${entry.players[0] && !entry.players[0].alive ? 'opacity-40' : ''}`}
      onClick={() => setExpanded(expanded === entry.role ? null : entry.role)}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{entry.icon}</span>
        <span className={`text-xs font-medium ${isWolf ? 'text-red-300' : 'text-white'}`}>{getRoleName(entry.role)}</span>
        {entry.isActing && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />}
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5 ml-6">{entry.statusLine}</p>
      {expanded === entry.role && entry.details && (
        <div className="mt-1.5 ml-6 space-y-0.5">
          {entry.details.map((d, i) => (
            <p key={i} className="text-[10px] text-gray-500">{d}</p>
          ))}
        </div>
      )}
    </button>
  );

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">神职技能</h3>
        <span className="text-[10px] text-gray-500">点击展开详情</span>
      </div>
      <div className="divide-y divide-white/5">
        {goodEntries.map(e => renderEntry(e, false))}
        {wolfEntries.length > 0 && (
          <div className="px-3 py-1 bg-red-500/5">
            <span className="text-[10px] text-red-400/60 font-medium">狼人阵营</span>
          </div>
        )}
        {wolfEntries.map(e => renderEntry(e, true))}
      </div>
    </div>
  );
}
