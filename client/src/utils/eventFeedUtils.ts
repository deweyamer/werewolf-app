import { Game, GamePlayer, GameEvent, ActionLog, ExileVoteState, SheriffElectionState, NightActionsState, RoundHistoryEntry } from '../../../shared/src/types';
import { translateDeathReason } from './phaseLabels';

let eventCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++eventCounter}`;
}

/**
 * 对比两次 Game 状态，推导出新的公共事件
 */
export function deriveEventsFromStateDiff(prev: Game | null, next: Game): GameEvent[] {
  const events: GameEvent[] = [];
  if (!prev) return events;

  const now = new Date().toISOString();

  // 1. 回合变化
  if (prev.currentRound !== next.currentRound && next.currentRound > 0) {
    events.push({
      id: nextId(`round-${next.currentRound}`),
      timestamp: now,
      round: next.currentRound,
      type: 'round_start',
      icon: '▶',
      text: `第${next.currentRound}轮开始`,
    });
  }

  // 2. 新的死亡
  for (const nextPlayer of next.players) {
    const prevPlayer = prev.players.find(p => p.playerId === nextPlayer.playerId);
    if (prevPlayer?.alive && !nextPlayer.alive) {
      events.push(formatDeathEvent(nextPlayer.playerId, next.currentRound, nextPlayer.outReason, next.players));
    }
  }

  // 3. 警长竞选结果（基于 sheriffElection.phase 变为 done，含计票详情）
  if (next.sheriffElection?.phase === 'done' && prev.sheriffElection?.phase !== 'done') {
    events.push(formatSheriffResultEvent(next.sheriffElection, next.currentRound, next.players));
  }

  // 4. 警长转移
  if (prev.sheriffId > 0 && next.sheriffId > 0 && prev.sheriffId !== next.sheriffId) {
    const newSheriff = next.players.find(p => p.playerId === next.sheriffId);
    events.push({
      id: nextId(`sheriff-transfer-${next.sheriffId}`),
      timestamp: now,
      round: next.currentRound,
      type: 'sheriff_transfer',
      icon: '→★',
      text: `警徽传递给 ${next.sheriffId}号${newSheriff ? ' ' + newSheriff.username : ''}`,
    });
  }

  // 5. 警徽流失
  if (prev.sheriffBadgeState !== 'destroyed' && next.sheriffBadgeState === 'destroyed') {
    events.push({
      id: nextId('sheriff-destroyed'),
      timestamp: now,
      round: next.currentRound,
      type: 'sheriff_transfer',
      icon: '✕',
      text: '警徽已流失',
    });
  }

  // 6. 放逐投票结果
  if (next.exileVote?.phase === 'done' && prev.exileVote?.phase !== 'done') {
    events.push(formatVoteResultEvent(next.exileVote, next.currentRound, next.players));
  }

  // 7. 游戏结束
  if (prev.status !== 'finished' && next.status === 'finished') {
    events.push({
      id: nextId('game-end'),
      timestamp: now,
      round: next.currentRound,
      type: 'game_end',
      icon: '🏁',
      text: `游戏结束 · ${next.winner === 'wolf' ? '狼人' : '好人'}阵营获胜`,
    });
  }

  return events;
}

/**
 * 从 game 状态恢复事件（重连/首次加载用）
 * 使用 roundHistory 结构化数据生成与实时流一致的事件
 */
export function deriveEventsFromHistory(game: Game): GameEvent[] {
  const events: GameEvent[] = [];
  const players = game.players;

  // 1. 从 roundHistory 提取结构化事件
  if (game.roundHistory && game.roundHistory.length > 0) {
    for (const round of game.roundHistory) {
      // 回合开始
      events.push({
        id: nextId(`history-round-${round.round}`),
        timestamp: game.startedAt || new Date().toISOString(),
        round: round.round,
        type: 'round_start',
        icon: '▶',
        text: `第${round.round}轮开始`,
      });

      // 夜晚结算（死亡/平安夜）
      // 注意：不使用 settlementMessage，因为它包含上帝视角信息（查验结果等）
      if (round.deaths && round.deaths.length > 0) {
        for (const playerId of round.deaths) {
          const player = players.find(p => p.playerId === playerId);
          events.push(formatDeathEvent(playerId, round.round, player?.outReason, players));
        }
      } else {
        events.push({
          id: nextId(`history-settle-${round.round}`),
          timestamp: game.startedAt || new Date().toISOString(),
          round: round.round,
          type: 'phase',
          icon: '🌙',
          text: '昨晚平安夜',
        });
      }

      // 警长选举结果
      if (round.sheriffElection?.phase === 'done') {
        events.push(formatSheriffResultEvent(round.sheriffElection, round.round, players));
      }

      // 放逐投票结果
      if (round.exileVote?.phase === 'done') {
        events.push(formatVoteResultEvent(round.exileVote, round.round, players));
      }
    }
  }

  // 2. 从 history 补充自爆日志
  if (game.history && game.history.length > 0) {
    const boomLogs = game.history.filter(log => log.visible === 'all' && log.action === 'boom');
    for (const log of boomLogs) {
      events.push({
        id: nextId(`history-${log.id}`),
        timestamp: log.timestamp,
        round: log.round,
        type: 'boom',
        icon: '💥',
        text: log.result,
      });
    }
  }

  // 3. 警徽流失
  if (game.sheriffBadgeState === 'destroyed') {
    events.push({
      id: nextId('history-sheriff-destroyed'),
      timestamp: new Date().toISOString(),
      round: game.currentRound,
      type: 'sheriff_transfer',
      icon: '✕',
      text: '警徽已流失',
    });
  }

  // 4. 游戏结束
  if (game.status === 'finished' && game.winner) {
    events.push({
      id: nextId('history-game-end'),
      timestamp: game.finishedAt || new Date().toISOString(),
      round: game.currentRound,
      type: 'game_end',
      icon: '🏁',
      text: `游戏结束 · ${game.winner === 'wolf' ? '狼人' : '好人'}阵营获胜`,
    });
  }

  // 按回合排序
  events.sort((a, b) => a.round - b.round);

  return events;
}

export function formatDeathEvent(playerId: number, round: number, reason: string | undefined, players: GamePlayer[]): GameEvent {
  const player = players.find(p => p.playerId === playerId);
  const reasonText = translateDeathReason(reason);
  return {
    id: nextId(`death-${round}-${playerId}`),
    timestamp: new Date().toISOString(),
    round,
    type: 'death',
    icon: '☠',
    text: `${playerId}号${player ? ' ' + player.username : ''} 出局`,
    details: reasonText,
  };
}

export function formatSheriffResultEvent(election: SheriffElectionState, round: number, players: GamePlayer[]): GameEvent {
  const winnerId = election.result;
  const winner = winnerId ? players.find(p => p.playerId === winnerId) : null;
  let tallyText: string | undefined;
  if (election.voteTally) {
    const parts = election.candidates
      .map(id => `${id}号:${election.voteTally?.[id] || 0}票`)
      .filter(Boolean);
    if (parts.length > 0) tallyText = parts.join(' / ');
  }
  return {
    id: nextId(`sheriff-result-${round}`),
    timestamp: new Date().toISOString(),
    round,
    type: 'sheriff',
    icon: '★',
    text: winner ? `${winnerId}号 ${winner.username} 当选警长` : '无人当选警长',
    details: tallyText,
  };
}

/**
 * 按目标聚合投票，生成明细文本
 * 格式: 5号←1,3,7号 / 2号←4,8号 / 弃票←6号
 */
function aggregateVoteDetails(votes: { [voterId: number]: number | 'skip' }): string | undefined {
  const targetToVoters = new Map<string, number[]>();
  for (const [voterId, targetId] of Object.entries(votes)) {
    const key = targetId === 'skip' ? 'skip' : String(targetId);
    if (!targetToVoters.has(key)) targetToVoters.set(key, []);
    targetToVoters.get(key)!.push(Number(voterId));
  }
  if (targetToVoters.size === 0) return undefined;

  // 按得票数降序排列（弃票放最后）
  const entries = [...targetToVoters.entries()].sort((a, b) => {
    if (a[0] === 'skip') return 1;
    if (b[0] === 'skip') return -1;
    return b[1].length - a[1].length;
  });

  const parts = entries.map(([target, voters]) => {
    const voterStr = voters.sort((a, b) => a - b).map(v => `${v}`).join(',');
    const label = target === 'skip' ? '弃票' : `${target}号`;
    return `${label}←${voterStr}号`;
  });

  return parts.join(' / ');
}

export function formatVoteResultEvent(exileVote: ExileVoteState, round: number, players: GamePlayer[]): GameEvent {
  if (exileVote.result === 'none' || exileVote.result === 'tie') {
    return {
      id: nextId(`vote-result-${round}`),
      timestamp: new Date().toISOString(),
      round,
      type: 'vote_result',
      icon: '⚖',
      text: exileVote.result === 'none' ? '本轮无人被放逐' : '投票平票',
      details: aggregateVoteDetails(exileVote.votes),
    };
  }

  const exiledId = exileVote.result as number;
  const exiled = players.find(p => p.playerId === exiledId);

  return {
    id: nextId(`vote-result-${round}`),
    timestamp: new Date().toISOString(),
    round,
    type: 'vote_result',
    icon: '⚖',
    text: `${exiledId}号${exiled ? ' ' + exiled.username : ''} 被放逐`,
    details: aggregateVoteDetails(exileVote.votes),
  };
}

/**
 * God 视角：从 NightActionsState 生成夜间行动事件
 */
export function deriveGodEventsFromNightActions(
  nightActions: NightActionsState,
  round: number,
  players: GamePlayer[]
): GameEvent[] {
  const events: GameEvent[] = [];
  const now = new Date().toISOString();
  const pName = (id: number) => {
    const p = players.find(pp => pp.playerId === id);
    return p ? `${id}号 ${p.username}` : `${id}号`;
  };

  if (nightActions.fearSubmitted && nightActions.fear) {
    events.push({ id: nextId(`god-fear-${round}`), timestamp: now, round, type: 'night_action', icon: '🌑', text: `噩梦之影 → 恐惧 ${pName(nightActions.fear)}` });
  }
  if (nightActions.dreamSubmitted && nightActions.dream) {
    events.push({ id: nextId(`god-dream-${round}`), timestamp: now, round, type: 'night_action', icon: '💤', text: `摄梦人 → 梦游 ${pName(nightActions.dream)}` });
  }
  if (nightActions.gargoyleSubmitted && nightActions.gargoyleTarget) {
    events.push({ id: nextId(`god-gargoyle-${round}`), timestamp: now, round, type: 'night_action', icon: '🗿', text: `石像鬼 → 查验 ${pName(nightActions.gargoyleTarget)}` });
  }
  if (nightActions.guardSubmitted) {
    const target = nightActions.guardTarget;
    events.push({ id: nextId(`god-guard-${round}`), timestamp: now, round, type: 'night_action', icon: '🛡️', text: target ? `守卫 → 守护 ${pName(target)}` : '守卫 → 空守' });
  }
  if (nightActions.wolfSubmitted) {
    const target = nightActions.wolfKill;
    events.push({ id: nextId(`god-wolf-${round}`), timestamp: now, round, type: 'night_action', icon: '🐺', text: target ? `狼人 → 击杀 ${pName(target)}` : '狼人 → 空刀' });
  }
  if (nightActions.wolfBeautySubmitted && nightActions.wolfBeautyTarget) {
    events.push({ id: nextId(`god-wolfbeauty-${round}`), timestamp: now, round, type: 'night_action', icon: '💃', text: `狼美人 → 魅惑 ${pName(nightActions.wolfBeautyTarget)}` });
  }
  if (nightActions.witchSubmitted) {
    const action = nightActions.witchAction;
    let text = '女巫 → 未用药';
    if (action === 'save') text = '女巫 → 使用解药';
    else if (action === 'poison') text = `女巫 → 毒杀 ${pName(nightActions.witchTarget!)}`;
    events.push({ id: nextId(`god-witch-${round}`), timestamp: now, round, type: 'night_action', icon: action === 'save' ? '💊' : action === 'poison' ? '🧪' : '🧙', text });
  }
  if (nightActions.seerSubmitted && nightActions.seerCheck) {
    events.push({ id: nextId(`god-seer-${round}`), timestamp: now, round, type: 'night_action', icon: '🔮', text: `预言家 → 查验 ${pName(nightActions.seerCheck)}`, details: nightActions.seerResult === 'wolf' ? '狼人' : '好人' });
  }
  if (nightActions.gravekeeperSubmitted && nightActions.gravekeeperTarget) {
    events.push({ id: nextId(`god-gravekeeper-${round}`), timestamp: now, round, type: 'night_action', icon: '⚰️', text: `守墓人 → 验尸 ${pName(nightActions.gravekeeperTarget)}` });
  }

  return events;
}

/**
 * God 视角：从 RoundHistoryEntry 生成完整一轮事件
 */
export function deriveGodEventsFromRoundHistory(
  entry: RoundHistoryEntry,
  players: GamePlayer[]
): GameEvent[] {
  const events: GameEvent[] = [];
  const now = new Date().toISOString();

  // 回合开始
  events.push({ id: nextId(`god-round-${entry.round}`), timestamp: now, round: entry.round, type: 'round_start', icon: '🌅', text: `第${entry.round}天` });

  // 夜间行动
  events.push(...deriveGodEventsFromNightActions(entry.nightActions, entry.round, players));

  // 结算
  if (entry.deaths.length > 0) {
    const deathNames = entry.deaths.map(id => {
      const p = players.find(pp => pp.playerId === id);
      return `${id}号${p ? '(' + p.username + ')' : ''}`;
    }).join('、');
    events.push({ id: nextId(`god-settle-${entry.round}`), timestamp: now, round: entry.round, type: 'settlement', icon: '📋', text: `结算: ${deathNames} 死亡`, details: entry.settlementMessage });
  } else {
    events.push({ id: nextId(`god-settle-${entry.round}`), timestamp: now, round: entry.round, type: 'settlement', icon: '📋', text: entry.settlementMessage || '平安夜' });
  }

  // 警长选举
  if (entry.sheriffElection?.phase === 'done') {
    events.push(formatSheriffResultEvent(entry.sheriffElection, entry.round, players));
  }

  // 放逐投票
  if (entry.exileVote?.phase === 'done') {
    events.push(formatVoteResultEvent(entry.exileVote, entry.round, players));
  }

  return events;
}
