import { Game, GameReplayData, PlayerReplayInfo, RoundReplayData, NightActionReplayRecord, DeathReplayInfo, SheriffElectionReplayRecord, ExileVoteReplayRecord, SpecialReplayEvent, RoundHistoryEntry } from '../../../shared/src/types';
import { getRoleName, translateDeathReason } from '../utils/phaseLabels';

// 夜间死亡原因（用于区分夜间/白天死亡）
const NIGHT_DEATH_REASONS = ['wolf_kill', 'poison', 'guard_save_conflict', 'dream_kill', 'wolf_beauty_link'];

export function useReplayData(currentGame: Game | null) {
  const generateReplayData = (): GameReplayData | null => {
    if (!currentGame) return null;

    // 计算游戏时长
    let duration = '';
    if (currentGame.startedAt && currentGame.finishedAt) {
      const start = new Date(currentGame.startedAt).getTime();
      const end = new Date(currentGame.finishedAt).getTime();
      const minutes = Math.floor((end - start) / 60000);
      duration = `${minutes}分钟`;
    }

    // 查找玩家死亡回合（从 roundHistory 中查找）
    const findDeathRound = (playerId: number): number | undefined => {
      if (currentGame.roundHistory) {
        for (const entry of currentGame.roundHistory) {
          if (entry.deaths.includes(playerId)) {
            return entry.round;
          }
        }
      }
      return undefined;
    };

    // 生成玩家信息
    const players: PlayerReplayInfo[] = currentGame.players.map(p => ({
      playerId: p.playerId,
      username: p.username,
      role: p.role || 'unknown',
      roleName: p.role ? getRoleName(p.role) : '未分配',
      camp: p.camp || 'good',
      isSheriff: p.isSheriff,
      deathRound: findDeathRound(p.playerId),
      deathReason: p.outReason ? translateDeathReason(p.outReason) : undefined,
    }));

    // 从 game.history 中提取自爆日志，按回合分组
    const boomByRound = new Map<number, SpecialReplayEvent[]>();
    if (currentGame.history) {
      for (const log of currentGame.history) {
        if (log.action === 'boom' && log.visible === 'all') {
          const events = boomByRound.get(log.round) || [];
          events.push({ type: 'boom', icon: '💥', text: log.result });
          boomByRound.set(log.round, events);
        }
      }
    }

    // 生成回合数据，并补充当前回合可能缺失的信息
    const rounds: RoundReplayData[] = [];
    const historyEntries = currentGame.roundHistory ? [...currentGame.roundHistory] : [];

    // 已被 roundHistory 记录的死亡玩家
    const recordedDeathPlayerIds = new Set(historyEntries.flatMap(h => h.deaths));
    // 实际已死亡但未被任何 roundHistory 记录的玩家
    const unrecordedDeadPlayers = currentGame.players.filter(
      p => !p.alive && !recordedDeathPlayerIds.has(p.playerId)
    );

    // 查找当前回合在 roundHistory 中的条目
    const maxHistoryRound = historyEntries.length > 0
      ? Math.max(...historyEntries.map(h => h.round))
      : 0;

    if (currentGame.currentRound > maxHistoryRound && currentGame.currentRound > 0) {
      // 当前回合完全不在 roundHistory 中 → 构建临时 entry
      // 警长选举只在第1轮发生，只有当前回合是第1轮时才补充
      const shouldSupplementSheriff = currentGame.currentRound === 1
        && currentGame.sheriffElection?.phase === 'done';
      historyEntries.push({
        round: currentGame.currentRound,
        nightActions: currentGame.nightActions || {},
        deaths: unrecordedDeadPlayers.map(p => p.playerId),
        settlementMessage: '',
        sheriffElection: shouldSupplementSheriff ? currentGame.sheriffElection : undefined,
        exileVote: currentGame.exileVote?.phase === 'done' ? currentGame.exileVote : undefined,
      });
    } else if (maxHistoryRound > 0) {
      // 当前回合已在 roundHistory 中，但可能缺少白天数据
      // 补充 game 级别的 exileVote/sheriffElection 到最后一个 entry
      const lastEntry = historyEntries[historyEntries.length - 1];
      if (lastEntry.round === currentGame.currentRound) {
        if (!lastEntry.exileVote && currentGame.exileVote?.phase === 'done') {
          lastEntry.exileVote = currentGame.exileVote;
        }
        // 不补充 sheriffElection：它是游戏级状态（从第1轮开始永不清除），
        // 服务端 saveSheriffElectionToHistory() 已将其存入正确回合的 roundHistory
        // 补充未记录的死亡
        if (unrecordedDeadPlayers.length > 0) {
          lastEntry.deaths = [...lastEntry.deaths, ...unrecordedDeadPlayers.map(p => p.playerId)];
        }
      }
    }

    for (const entry of historyEntries) {
      // 跳过没有实际内容的空 entry
      const hasContent = entry.deaths.length > 0 ||
        entry.sheriffElection ||
        entry.exileVote ||
        Object.keys(entry.nightActions).length > 0 ||
        boomByRound.has(entry.round);
      if (hasContent) {
        rounds.push(buildRoundReplay(currentGame, entry, boomByRound));
      }
    }

    return {
      meta: {
        roomCode: currentGame.roomCode,
        scriptName: currentGame.scriptName,
        playerCount: currentGame.players.length,
        duration,
        winner: currentGame.winner || null,
        startTime: currentGame.startedAt || '',
        endTime: currentGame.finishedAt || '',
      },
      players,
      rounds,
    };
  };

  return { generateReplayData };
}

/**
 * 从单个 RoundHistoryEntry 构建一轮复盘数据
 */
function buildRoundReplay(
  game: Game,
  entry: RoundHistoryEntry,
  boomByRound: Map<number, SpecialReplayEvent[]>,
): RoundReplayData {
  const na = entry.nightActions;

  // ========== 夜间行动 ==========
  const nightActions: NightActionReplayRecord[] = [];

  // 噩梦之影
  if (na.fear !== undefined) {
    const nightmare = game.players.find(p => p.role === 'nightmare');
    const target = game.players.find(p => p.playerId === na.fear);
    nightActions.push({
      role: 'nightmare', roleName: '噩梦之影',
      playerId: nightmare?.playerId || 0,
      action: '恐惧', target: na.fear, targetName: target?.username,
    });
  }

  // 摄梦人
  if (na.dream !== undefined) {
    const dreamer = game.players.find(p => p.role === 'dreamer');
    const target = game.players.find(p => p.playerId === na.dream);
    nightActions.push({
      role: 'dreamer', roleName: '摄梦人',
      playerId: dreamer?.playerId || 0,
      action: '摄梦', target: na.dream, targetName: target?.username,
    });
  }

  // 石像鬼
  if (na.gargoyleTarget !== undefined) {
    const gargoyle = game.players.find(p => p.role === 'gargoyle');
    const target = game.players.find(p => p.playerId === na.gargoyleTarget);
    nightActions.push({
      role: 'gargoyle', roleName: '石像鬼',
      playerId: gargoyle?.playerId || 0,
      action: '查验', target: na.gargoyleTarget, targetName: target?.username,
    });
  }

  // 守卫
  if (na.guardTarget !== undefined) {
    const guard = game.players.find(p => p.role === 'guard');
    const target = game.players.find(p => p.playerId === na.guardTarget);
    nightActions.push({
      role: 'guard', roleName: '守卫',
      playerId: guard?.playerId || 0,
      action: '守护', target: na.guardTarget, targetName: target?.username,
    });
  }

  // 狼人刀人
  if (na.wolfKill !== undefined) {
    const target = game.players.find(p => p.playerId === na.wolfKill);
    nightActions.push({
      role: 'wolf', roleName: '狼人',
      playerId: 0, action: '刀人',
      target: na.wolfKill, targetName: target?.username,
    });
  }

  // 狼美人
  if (na.wolfBeautyTarget !== undefined) {
    const wolfBeauty = game.players.find(p => p.role === 'wolf_beauty');
    const target = game.players.find(p => p.playerId === na.wolfBeautyTarget);
    nightActions.push({
      role: 'wolf_beauty', roleName: '狼美人',
      playerId: wolfBeauty?.playerId || 0,
      action: '魅惑', target: na.wolfBeautyTarget, targetName: target?.username,
    });
  }

  // 女巫
  if (na.witchAction && na.witchAction !== 'none') {
    const witch = game.players.find(p => p.role === 'witch');
    const target = na.witchTarget ? game.players.find(p => p.playerId === na.witchTarget) : null;
    nightActions.push({
      role: 'witch', roleName: '女巫',
      playerId: witch?.playerId || 0,
      action: na.witchAction === 'save' ? '使用解药' : '使用毒药',
      target: na.witchTarget, targetName: target?.username,
    });
  }

  // 预言家
  if (na.seerCheck !== undefined) {
    const seer = game.players.find(p => p.role === 'seer');
    const target = game.players.find(p => p.playerId === na.seerCheck);
    nightActions.push({
      role: 'seer', roleName: '预言家',
      playerId: seer?.playerId || 0,
      action: '查验', target: na.seerCheck, targetName: target?.username,
      result: na.seerResult === 'wolf' ? '狼人' : '好人',
    });
  }

  // 守墓人
  if (na.gravekeeperTarget !== undefined) {
    const gravekeeper = game.players.find(p => p.role === 'gravekeeper');
    const target = game.players.find(p => p.playerId === na.gravekeeperTarget);
    nightActions.push({
      role: 'gravekeeper', roleName: '守墓人',
      playerId: gravekeeper?.playerId || 0,
      action: '验尸', target: na.gravekeeperTarget, targetName: target?.username,
    });
  }

  // ========== 警长竞选 ==========
  let sheriffElection: SheriffElectionReplayRecord | undefined = undefined;
  const electionData = entry.sheriffElection || (entry.round === 1 ? game.sheriffElection : undefined);
  if (electionData) {
    sheriffElection = buildSheriffElectionReplay(game, electionData);
  }

  // ========== 放逐投票 ==========
  let exileVote: ExileVoteReplayRecord | undefined = undefined;
  if (entry.exileVote) {
    exileVote = buildExileVoteReplay(game, entry.exileVote);
  }

  // ========== 死亡分类 ==========
  const allDeaths: DeathReplayInfo[] = entry.deaths.map((playerId: number) => {
    const player = game.players.find(p => p.playerId === playerId);
    return {
      playerId,
      playerName: player?.username || `${playerId}号`,
      role: player?.role || 'unknown',
      roleName: player?.role ? getRoleName(player.role) : '未知',
      cause: player?.outReason || 'unknown',
      causeText: translateDeathReason(player?.outReason),
    };
  });
  const nightDeaths = allDeaths.filter(d => NIGHT_DEATH_REASONS.includes(d.cause));
  const dayDeaths = allDeaths.filter(d => !NIGHT_DEATH_REASONS.includes(d.cause));

  // ========== 白天特殊事件 ==========
  const specialEvents: SpecialReplayEvent[] = [];

  // 自爆事件
  const boomEvents = boomByRound.get(entry.round);
  if (boomEvents) specialEvents.push(...boomEvents);

  // 猎人开枪 / 骑士决斗（从死亡原因推导）
  for (const d of [...nightDeaths, ...dayDeaths]) {
    if (d.cause === 'hunter_shoot') {
      const hunter = game.players.find(p => p.role === 'hunter');
      specialEvents.push({
        type: 'hunter_shoot', icon: '🏹',
        text: `猎人${hunter ? hunter.playerId + '号' : ''}开枪带走 ${d.playerId}号(${d.roleName})`,
      });
    }
    if (d.cause === 'knight_duel') {
      specialEvents.push({
        type: 'knight_duel', icon: '⚔️',
        text: `骑士决斗 → ${d.playerId}号(${d.roleName}) 出局`,
      });
    }
  }

  return {
    round: entry.round,
    night: {
      actions: nightActions,
      settlement: entry.settlementMessage || '结算完成',
      deaths: nightDeaths,
    },
    day: {
      sheriffElection,
      exileVote,
      deaths: dayDeaths,
      specialEvents: specialEvents.length > 0 ? specialEvents : undefined,
    },
  };
}

function buildSheriffElectionReplay(game: Game, electionData: any): SheriffElectionReplayRecord {
  const election = electionData;
  const winner = election.result ? game.players.find(p => p.playerId === election.result) : null;

  const voteRecords = Object.entries(election.votes).map(([voterId, targetId]) => {
    const voter = game.players.find(p => p.playerId === Number(voterId));
    const target = targetId !== 'skip' ? game.players.find(p => p.playerId === Number(targetId)) : null;
    return {
      voterId: Number(voterId),
      voterName: voter?.username || `${voterId}号`,
      voteWeight: voter?.isSheriff ? 1.5 : 1,
      targetId: targetId as number | 'skip',
      targetName: target?.username,
    };
  });

  const tallyMap = new Map<number, number>();
  if (election.voteTally) {
    Object.entries(election.voteTally).forEach(([candidateId, count]) => {
      tallyMap.set(Number(candidateId), count as number);
    });
  } else {
    voteRecords.forEach(v => {
      if (v.targetId !== 'skip') {
        tallyMap.set(v.targetId as number, (tallyMap.get(v.targetId as number) || 0) + v.voteWeight);
      }
    });
  }

  const tally = Array.from(tallyMap.entries())
    .map(([playerId, voteCount]) => {
      const p = game.players.find(pp => pp.playerId === playerId);
      return { playerId, playerName: p?.username || `${playerId}号`, voteCount };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  return {
    candidates: election.candidates.map((id: number) => {
      const p = game.players.find(pp => pp.playerId === id);
      return { playerId: id, playerName: p?.username || `${id}号` };
    }),
    withdrawn: (election.withdrawn || []).map((id: number) => {
      const p = game.players.find(pp => pp.playerId === id);
      return { playerId: id, playerName: p?.username || `${id}号` };
    }),
    votes: voteRecords,
    tally,
    result: {
      winnerId: election.result || null,
      winnerName: winner?.username,
      isTie: election.phase === 'tie',
      tiedPlayers: election.tiedPlayers,
    },
  };
}

function buildExileVoteReplay(game: Game, exileVoteData: any): ExileVoteReplayRecord {
  const votes = Object.entries(exileVoteData.votes).map(([voterId, targetId]) => {
    const voter = game.players.find(p => p.playerId === Number(voterId));
    const target = targetId !== 'skip' ? game.players.find(p => p.playerId === Number(targetId)) : null;
    return {
      voterId: Number(voterId),
      voterName: voter?.username || `${voterId}号`,
      voteWeight: voter?.isSheriff ? 1.5 : 1,
      targetId: targetId as number | 'skip',
      targetName: target?.username,
    };
  });

  const tallyMap = new Map<number, number>();
  votes.forEach(v => {
    if (v.targetId !== 'skip') {
      tallyMap.set(v.targetId as number, (tallyMap.get(v.targetId as number) || 0) + v.voteWeight);
    }
  });

  const tally = Array.from(tallyMap.entries())
    .map(([playerId, voteCount]) => {
      const p = game.players.find(pp => pp.playerId === playerId);
      return { playerId, playerName: p?.username || `${playerId}号`, voteCount };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  const exiledId = typeof exileVoteData.result === 'number' ? exileVoteData.result : null;
  const exiled = exiledId ? game.players.find(p => p.playerId === exiledId) : null;

  return {
    votes,
    tally,
    result: {
      exiledId,
      exiledName: exiled?.username,
      isTie: exileVoteData.result === 'tie',
      isPeace: exileVoteData.result === 'none' || exileVoteData.result === 'tie',
    },
  };
}
