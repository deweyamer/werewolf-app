import { Game, GameReplayData, PlayerReplayInfo, RoundReplayData, NightActionReplayRecord, DeathReplayInfo, SheriffElectionReplayRecord, ExileVoteReplayRecord } from '../../../shared/src/types';
import { getRoleName, translateDeathReason } from '../utils/phaseLabels';

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

    // 查找玩家死亡回合
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

    // 生成回合数据
    const rounds: RoundReplayData[] = [];
    if (currentGame.roundHistory) {
      for (const entry of currentGame.roundHistory) {
        const nightActions: NightActionReplayRecord[] = [];
        const na = entry.nightActions;

        // 狼人刀人
        if (na.wolfKill !== undefined) {
          const target = currentGame.players.find(p => p.playerId === na.wolfKill);
          nightActions.push({
            role: 'wolf',
            roleName: '狼人',
            playerId: 0,
            action: '刀人',
            target: na.wolfKill,
            targetName: target?.username,
          });
        }

        // 守卫守护
        if (na.guardTarget !== undefined) {
          const guard = currentGame.players.find(p => p.role === 'guard');
          const target = currentGame.players.find(p => p.playerId === na.guardTarget);
          nightActions.push({
            role: 'guard',
            roleName: '守卫',
            playerId: guard?.playerId || 0,
            action: '守护',
            target: na.guardTarget,
            targetName: target?.username,
          });
        }

        // 女巫行动
        if (na.witchAction && na.witchAction !== 'none') {
          const witch = currentGame.players.find(p => p.role === 'witch');
          const target = na.witchTarget ? currentGame.players.find(p => p.playerId === na.witchTarget) : null;
          nightActions.push({
            role: 'witch',
            roleName: '女巫',
            playerId: witch?.playerId || 0,
            action: na.witchAction === 'save' ? '使用解药' : '使用毒药',
            target: na.witchTarget,
            targetName: target?.username,
          });
        }

        // 预言家查验
        if (na.seerCheck !== undefined) {
          const seer = currentGame.players.find(p => p.role === 'seer');
          const target = currentGame.players.find(p => p.playerId === na.seerCheck);
          nightActions.push({
            role: 'seer',
            roleName: '预言家',
            playerId: seer?.playerId || 0,
            action: '查验',
            target: na.seerCheck,
            targetName: target?.username,
            result: na.seerResult === 'wolf' ? '狼人' : '好人',
          });
        }

        // 恐惧（噩梦之影）
        if (na.fear !== undefined) {
          const nightmare = currentGame.players.find(p => p.role === 'nightmare');
          const target = currentGame.players.find(p => p.playerId === na.fear);
          nightActions.push({
            role: 'nightmare',
            roleName: '噩梦之影',
            playerId: nightmare?.playerId || 0,
            action: '恐惧',
            target: na.fear,
            targetName: target?.username,
          });
        }

        // 摄梦人
        if (na.dream !== undefined) {
          const dreamer = currentGame.players.find(p => p.role === 'dreamer');
          const target = currentGame.players.find(p => p.playerId === na.dream);
          nightActions.push({
            role: 'dreamer',
            roleName: '摄梦人',
            playerId: dreamer?.playerId || 0,
            action: '摄梦',
            target: na.dream,
            targetName: target?.username,
          });
        }

        // 警长竞选（仅第1轮）
        let sheriffElection: SheriffElectionReplayRecord | undefined = undefined;
        if (entry.round === 1 && currentGame.sheriffElection) {
          const election = currentGame.sheriffElection;
          const winner = election.result ? currentGame.players.find(p => p.playerId === election.result) : null;
          sheriffElection = {
            candidates: election.candidates.map(id => {
              const p = currentGame.players.find(p => p.playerId === id);
              return { playerId: id, playerName: p?.username || `${id}号` };
            }),
            withdrawn: election.withdrawn.map(id => {
              const p = currentGame.players.find(p => p.playerId === id);
              return { playerId: id, playerName: p?.username || `${id}号` };
            }),
            votes: Object.entries(election.votes).map(([voterId, targetId]) => {
              const voter = currentGame.players.find(p => p.playerId === Number(voterId));
              const target = targetId !== 'skip' ? currentGame.players.find(p => p.playerId === targetId) : null;
              return {
                voterId: Number(voterId),
                voterName: voter?.username || `${voterId}号`,
                targetId: targetId,
                targetName: target?.username,
              };
            }),
            result: {
              winnerId: election.result || null,
              winnerName: winner?.username,
              isTie: election.phase === 'tie',
              tiedPlayers: election.tiedPlayers,
            },
          };
        }

        // 放逐投票
        let exileVote: ExileVoteReplayRecord | undefined = undefined;
        if (entry.exileVote) {
          const votes = Object.entries(entry.exileVote.votes).map(([voterId, targetId]) => {
            const voter = currentGame.players.find(p => p.playerId === Number(voterId));
            const target = targetId !== 'skip' ? currentGame.players.find(p => p.playerId === Number(targetId)) : null;
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
              const p = currentGame.players.find(p => p.playerId === playerId);
              return { playerId, playerName: p?.username || `${playerId}号`, voteCount };
            })
            .sort((a, b) => b.voteCount - a.voteCount);

          const exiledId = typeof entry.exileVote.result === 'number' ? entry.exileVote.result : null;
          const exiled = exiledId ? currentGame.players.find(p => p.playerId === exiledId) : null;

          exileVote = {
            votes,
            tally,
            result: {
              exiledId,
              exiledName: exiled?.username,
              isTie: entry.exileVote.result === 'tie',
              isPeace: entry.exileVote.result === 'none' || entry.exileVote.result === 'tie',
            },
          };
        }

        // 从entry.deaths中提取死亡信息
        const allDeaths: DeathReplayInfo[] = entry.deaths.map((playerId: number) => {
          const player = currentGame.players.find(p => p.playerId === playerId);
          return {
            playerId,
            playerName: player?.username || `${playerId}号`,
            role: player?.role || 'unknown',
            roleName: player?.role ? getRoleName(player.role) : '未知',
            cause: player?.outReason || 'unknown',
            causeText: translateDeathReason(player?.outReason),
          };
        });

        rounds.push({
          round: entry.round,
          night: {
            actions: nightActions,
            settlement: entry.settlementMessage || '结算完成',
            deaths: [],
          },
          day: {
            sheriffElection,
            exileVote,
            deaths: allDeaths,
          },
        });
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
