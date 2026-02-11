import {
  Game,
  GameReplayData,
  PlayerReplayInfo,
  RoundReplayData,
  NightActionReplayRecord,
  DeathReplayInfo,
  SheriffElectionReplayRecord,
  ExileVoteReplayRecord,
  WolfChatMessage,
} from '../../../shared/src/types.js';
import { ROLES } from '../../../shared/src/constants.js';

/**
 * 复盘服务 - 生成游戏复盘数据和可视化代码
 */
export class ReplayService {
  /**
   * 将 Game 对象转换为复盘数据
   */
  generateReplayData(game: Game): GameReplayData {
    // 计算游戏时长
    let duration = '';
    if (game.startedAt && game.finishedAt) {
      const start = new Date(game.startedAt).getTime();
      const end = new Date(game.finishedAt).getTime();
      const minutes = Math.floor((end - start) / 60000);
      duration = `${minutes}分钟`;
    }

    // 生成玩家信息
    const players: PlayerReplayInfo[] = game.players.map(p => {
      const roleInfo = ROLES[p.role];
      return {
        playerId: p.playerId,
        username: p.username,
        role: p.role,
        roleName: roleInfo?.name || p.role,
        camp: p.camp,
        isSheriff: p.isSheriff,
        deathRound: this.findDeathRound(game, p.playerId),
        deathReason: p.outReason ? this.translateDeathReason(p.outReason) : undefined,
      };
    });

    // 生成回合数据
    const rounds: RoundReplayData[] = [];
    if (game.roundHistory) {
      for (const entry of game.roundHistory) {
        rounds.push(this.convertRoundHistoryToReplay(game, entry));
      }
    }

    return {
      meta: {
        roomCode: game.roomCode,
        scriptName: game.scriptName,
        playerCount: game.players.length,
        duration,
        winner: game.winner || null,
        startTime: game.startedAt || '',
        endTime: game.finishedAt || '',
      },
      players,
      rounds,
    };
  }

  /**
   * 转换回合历史为复盘数据
   */
  private convertRoundHistoryToReplay(game: Game, entry: any): RoundReplayData {
    const nightActions: NightActionReplayRecord[] = [];
    const na = entry.nightActions;

    // 狼人刀人
    if (na.wolfKill !== undefined) {
      const target = game.players.find(p => p.playerId === na.wolfKill);
      nightActions.push({
        role: 'wolf',
        roleName: '狼人',
        playerId: 0, // 狼人是团体行动
        action: '刀人',
        target: na.wolfKill,
        targetName: target?.username,
      });
    }

    // 守卫守护
    if (na.guardTarget !== undefined) {
      const guard = game.players.find(p => p.role === 'guard');
      const target = game.players.find(p => p.playerId === na.guardTarget);
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
      const witch = game.players.find(p => p.role === 'witch');
      const target = na.witchTarget ? game.players.find(p => p.playerId === na.witchTarget) : null;
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
      const seer = game.players.find(p => p.role === 'seer');
      const target = game.players.find(p => p.playerId === na.seerCheck);
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
      const nightmare = game.players.find(p => p.role === 'nightmare');
      const target = game.players.find(p => p.playerId === na.fear);
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
      const dreamer = game.players.find(p => p.role === 'dreamer');
      const target = game.players.find(p => p.playerId === na.dream);
      nightActions.push({
        role: 'dreamer',
        roleName: '摄梦人',
        playerId: dreamer?.playerId || 0,
        action: '摄梦',
        target: na.dream,
        targetName: target?.username,
      });
    }

    // 狼人聊天记录
    const wolfChat: WolfChatMessage[] = na.wolfChat || [];

    // 构建夜间死亡列表
    const nightDeaths: DeathReplayInfo[] = [];
    // 从entry.deaths中筛选夜间死亡（这里简化处理）

    // 构建白天数据
    const dayData: RoundReplayData['day'] = {
      deaths: [],
    };

    // 警长竞选：优先从 roundHistory 快照读取，fallback 到 game.sheriffElection
    const electionData = entry.sheriffElection || (entry.round === 1 ? game.sheriffElection : undefined);
    if (electionData) {
      dayData.sheriffElection = this.convertSheriffElection(game, electionData);
    }

    // 放逐投票
    if (entry.exileVote) {
      dayData.exileVote = this.convertExileVote(game, entry.exileVote);
    }

    // 从entry.deaths中提取死亡信息
    const allDeaths: DeathReplayInfo[] = entry.deaths.map((playerId: number) => {
      const player = game.players.find(p => p.playerId === playerId);
      const roleInfo = player?.role ? ROLES[player.role] : null;
      return {
        playerId,
        playerName: player?.username || `${playerId}号`,
        role: player?.role || 'unknown',
        roleName: roleInfo?.name || '未知',
        cause: player?.outReason || 'unknown',
        causeText: this.translateDeathReason(player?.outReason),
      };
    });

    return {
      round: entry.round,
      night: {
        actions: nightActions,
        wolfChat: wolfChat.length > 0 ? wolfChat : undefined,
        settlement: entry.settlementMessage || '结算完成',
        deaths: nightDeaths,
      },
      day: {
        ...dayData,
        deaths: allDeaths,
      },
    };
  }

  /**
   * 转换警长竞选数据
   */
  private convertSheriffElection(game: Game, election: any): SheriffElectionReplayRecord {
    if (!election) {
      return {
        candidates: [],
        withdrawn: [],
        votes: [],
        tally: [],
        result: { winnerId: null, isTie: false },
      };
    }

    const candidates = (election.candidates || []).map((id: number) => {
      const p = game.players.find(p => p.playerId === id);
      return { playerId: id, playerName: p?.username || `${id}号` };
    });

    const withdrawn = (election.withdrawn || []).map((id: number) => {
      const p = game.players.find(p => p.playerId === id);
      return { playerId: id, playerName: p?.username || `${id}号` };
    });

    const votes = Object.entries(election.votes || {}).map(([voterId, targetId]) => {
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

    // 从 voteTally 生成计票汇总，或从 votes 重新计算
    const tallyMap = new Map<number, number>();
    if (election.voteTally) {
      Object.entries(election.voteTally).forEach(([candidateId, count]) => {
        tallyMap.set(Number(candidateId), count as number);
      });
    } else {
      // fallback：从 votes 重新计算
      votes.forEach(v => {
        if (v.targetId !== 'skip') {
          tallyMap.set(v.targetId as number, (tallyMap.get(v.targetId as number) || 0) + v.voteWeight);
        }
      });
    }

    const tally = Array.from(tallyMap.entries())
      .map(([playerId, voteCount]) => {
        const p = game.players.find(p => p.playerId === playerId);
        return {
          playerId,
          playerName: p?.username || `${playerId}号`,
          voteCount,
        };
      })
      .sort((a, b) => b.voteCount - a.voteCount);

    const winner = election.result ? game.players.find(p => p.playerId === election.result) : null;

    return {
      candidates,
      withdrawn,
      votes,
      tally,
      result: {
        winnerId: election.result || null,
        winnerName: winner?.username,
        isTie: election.phase === 'tie',
        tiedPlayers: election.tiedPlayers,
      },
    };
  }

  /**
   * 转换放逐投票数据
   */
  private convertExileVote(game: Game, exileVote: any): ExileVoteReplayRecord {
    const votes = Object.entries(exileVote.votes).map(([voterId, targetId]) => {
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

    // 统计票数
    const tallyMap = new Map<number, number>();
    votes.forEach(v => {
      if (v.targetId !== 'skip') {
        tallyMap.set(v.targetId as number, (tallyMap.get(v.targetId as number) || 0) + v.voteWeight);
      }
    });

    const tally = Array.from(tallyMap.entries())
      .map(([playerId, voteCount]) => {
        const p = game.players.find(p => p.playerId === playerId);
        return {
          playerId,
          playerName: p?.username || `${playerId}号`,
          voteCount,
        };
      })
      .sort((a, b) => b.voteCount - a.voteCount);

    const exiledId = typeof exileVote.result === 'number' ? exileVote.result : null;
    const exiled = exiledId ? game.players.find(p => p.playerId === exiledId) : null;

    return {
      votes,
      tally,
      result: {
        exiledId,
        exiledName: exiled?.username,
        isTie: exileVote.result === 'tie',
        isPeace: exileVote.result === 'none' || exileVote.result === 'tie',
      },
    };
  }

  /**
   * 生成 Mermaid 流程图代码
   */
  generateMermaidCode(data: GameReplayData): string {
    let code = 'flowchart TB\n';

    // 添加游戏信息节点
    code += `    TITLE["狼人杀复盘\\n${data.meta.scriptName}\\n${data.meta.winner === 'wolf' ? '狼人胜' : data.meta.winner === 'good' ? '好人胜' : '进行中'}"]\n`;

    // 为每个回合生成节点
    data.rounds.forEach((round, index) => {
      const roundId = `R${round.round}`;

      // 回合容器
      code += `    subgraph ${roundId}["第${round.round}回合"]\n`;

      // 夜间行动
      code += `        subgraph ${roundId}N["🌙 夜晚"]\n`;
      round.night.actions.forEach((action, i) => {
        const actionId = `${roundId}N${i}`;
        let label = `${this.getRoleEmoji(action.role)} ${action.action}`;
        if (action.target) {
          label += ` ${action.target}号`;
        }
        if (action.result) {
          label += `=${action.result}`;
        }
        code += `            ${actionId}["${label}"]\n`;
      });
      code += `        end\n`;

      // 结算
      code += `        ${roundId}SET["📋 ${round.night.settlement}"]\n`;

      // 白天阶段
      code += `        subgraph ${roundId}D["☀️ 白天"]\n`;

      // 警长竞选
      if (round.day.sheriffElection && round.day.sheriffElection.result.winnerId) {
        code += `            ${roundId}SH["🎖️ ${round.day.sheriffElection.result.winnerId}号当选警长"]\n`;
      }

      // 放逐投票
      if (round.day.exileVote) {
        const result = round.day.exileVote.result;
        let voteLabel = '🗳️ ';
        if (result.exiledId) {
          voteLabel += `${result.exiledId}号被放逐`;
        } else if (result.isTie) {
          voteLabel += '平票';
        } else {
          voteLabel += '无人出局';
        }
        code += `            ${roundId}V["${voteLabel}"]\n`;
      }

      code += `        end\n`;

      // 死亡信息
      if (round.day.deaths.length > 0) {
        const deathList = round.day.deaths.map(d => `${d.playerId}号`).join(' ');
        code += `        ${roundId}DEAD["💀 ${deathList}"]\n`;
      }

      code += `    end\n`;

      // 连接到下一回合
      if (index < data.rounds.length - 1) {
        code += `    ${roundId} --> R${data.rounds[index + 1].round}\n`;
      }
    });

    // 游戏结束节点
    if (data.meta.winner) {
      const lastRoundId = data.rounds.length > 0 ? `R${data.rounds[data.rounds.length - 1].round}` : 'TITLE';
      code += `    ${lastRoundId} --> END["🏆 ${data.meta.winner === 'wolf' ? '狼人阵营' : '好人阵营'}获胜"]\n`;
    }

    return code;
  }

  /**
   * 获取角色emoji
   */
  private getRoleEmoji(role: string): string {
    const emojiMap: { [key: string]: string } = {
      wolf: '🐺',
      white_wolf: '🐺',
      black_wolf: '🐺',
      wolf_beauty: '💋',
      seer: '🔮',
      witch: '🧪',
      guard: '🛡️',
      hunter: '🏹',
      villager: '👤',
      nightmare: '😱',
      dreamer: '💤',
      gravekeeper: '⚰️',
      gargoyle: '🗿',
      knight: '⚔️',
    };
    return emojiMap[role] || '❓';
  }

  /**
   * 查找玩家死亡回合
   */
  private findDeathRound(game: Game, playerId: number): number | undefined {
    const player = game.players.find(p => p.playerId === playerId);
    if (!player || player.alive) return undefined;

    // 从历史记录中查找
    if (game.roundHistory) {
      for (const entry of game.roundHistory) {
        if (entry.deaths.includes(playerId)) {
          return entry.round;
        }
      }
    }

    return undefined;
  }

  /**
   * 翻译死因
   */
  private translateDeathReason(reason?: string): string {
    if (!reason) return '未知';

    const reasonMap: { [key: string]: string } = {
      wolf_kill: '被狼人杀害',
      poison: '被女巫毒杀',
      exile: '被放逐出局',
      hunter: '被猎人带走',
      knight_duel: '决斗出局',
      wolf_explosion: '狼人自爆',
      dream_kill: '被摄梦人梦杀',
      charm_death: '被狼美人魅惑致死',
    };

    return reasonMap[reason] || reason;
  }
}
