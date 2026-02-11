import { Game, SheriffElectionState, ExileVoteState, SheriffBadgeState } from '../../../shared/src/types.js';
import { DeathReason } from '../game/skill/SkillTypes.js';

export class VotingSystem {
  // ================= 警长竞选系统 =================

  /**
   * 开始警长竞选 - 上警环节
   */
  startSheriffElection(game: Game): void {
    game.sheriffElection = {
      phase: 'signup',
      candidates: [],
      withdrawn: [],
      votes: {},
    };

    // 重置所有玩家的警长竞选状态（undefined 表示尚未做出选择）
    game.players.forEach(p => {
      p.sheriffCandidate = undefined;
      p.sheriffWithdrawn = false;
    });
  }

  /**
   * 玩家上警/不上警
   */
  sheriffSignup(game: Game, playerId: number, runForSheriff: boolean): boolean {
    if (!game.sheriffElection || game.sheriffElection.phase !== 'signup') {
      return false;
    }

    const player = game.players.find(p => p.playerId === playerId);
    if (!player || !player.alive) return false;

    player.sheriffCandidate = runForSheriff;

    if (runForSheriff) {
      if (!game.sheriffElection.candidates.includes(playerId)) {
        game.sheriffElection.candidates.push(playerId);
      }
    } else {
      const index = game.sheriffElection.candidates.indexOf(playerId);
      if (index > -1) {
        game.sheriffElection.candidates.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * 进入竞选发言阶段
   */
  startSheriffCampaign(game: Game): boolean {
    if (!game.sheriffElection || game.sheriffElection.phase !== 'signup') {
      return false;
    }

    // 如果没人上警,直接跳过警长竞选
    if (game.sheriffElection.candidates.length === 0) {
      game.sheriffElectionDone = true;
      game.sheriffElection = undefined;
      return false;
    }

    // 如果只有一人上警,直接当选
    if (game.sheriffElection.candidates.length === 1) {
      const winner = game.sheriffElection.candidates[0];
      this.electSheriff(game, winner);
      return false;
    }

    game.sheriffElection.phase = 'campaign';
    return true;
  }

  /**
   * 玩家退水
   */
  sheriffWithdraw(game: Game, playerId: number): boolean {
    if (!game.sheriffElection || game.sheriffElection.phase !== 'campaign') {
      return false;
    }

    const index = game.sheriffElection.candidates.indexOf(playerId);
    if (index === -1) return false;

    game.sheriffElection.candidates.splice(index, 1);
    game.sheriffElection.withdrawn.push(playerId);

    const player = game.players.find(p => p.playerId === playerId);
    if (player) {
      player.sheriffWithdrawn = true;
      player.sheriffCandidate = false;
    }

    // 如果退水后只剩一人,直接当选
    if (game.sheriffElection.candidates.length === 1) {
      const winner = game.sheriffElection.candidates[0];
      this.electSheriff(game, winner);
      return true;
    }

    // 如果全部退水,无警长
    if (game.sheriffElection.candidates.length === 0) {
      game.sheriffElectionDone = true;
      game.sheriffElection = undefined;
      return true;
    }

    return true;
  }

  /**
   * 开始投票环节
   */
  startSheriffVoting(game: Game): boolean {
    if (!game.sheriffElection ||
        (game.sheriffElection.phase !== 'campaign' &&
         game.sheriffElection.phase !== 'signup')) {
      return false;
    }

    game.sheriffElection.phase = 'voting';
    game.sheriffElection.votes = {};
    return true;
  }

  /**
   * 投票警长
   */
  voteForSheriff(game: Game, voterId: number, candidateId: number | 'skip'): boolean {
    if (!game.sheriffElection || game.sheriffElection.phase !== 'voting') {
      return false;
    }

    const voter = game.players.find(p => p.playerId === voterId);
    if (!voter || !voter.alive) return false;

    // 上警的人不能投票（包括退水的人）
    if (game.sheriffElection.candidates.includes(voterId) ||
        game.sheriffElection.withdrawn.includes(voterId)) {
      return false;
    }

    // 只能投给候选人
    if (candidateId !== 'skip' && !game.sheriffElection.candidates.includes(candidateId)) {
      return false;
    }

    game.sheriffElection.votes[voterId] = candidateId;
    return true;
  }

  /**
   * 统计警长选举结果
   * 返回值：{ winner: 当选者 | null, isTie: 是否平票, tiedPlayers?: 平票玩家列表 }
   */
  tallySheriffVotes(game: Game): { winner: number | null; isTie: boolean; tiedPlayers?: number[] } {
    if (!game.sheriffElection) return { winner: null, isTie: false };

    const voteCounts = new Map<number, number>();

    Object.entries(game.sheriffElection.votes).forEach(([voterIdStr, candidateId]) => {
      if (candidateId === 'skip') return;

      const voterId = Number(voterIdStr);
      const voter = game.players.find(p => p.playerId === voterId);

      // 警长有1.5票权重
      const voteWeight = voter?.isSheriff ? 1.5 : 1;

      voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + voteWeight);
    });

    // 持久化加权计票结果到 sheriffElection.voteTally
    const voteTally: { [candidateId: number]: number } = {};
    voteCounts.forEach((count, candidateId) => {
      voteTally[candidateId] = count;
    });
    game.sheriffElection.voteTally = voteTally;

    // 如果没有人投票，无警长
    if (voteCounts.size === 0) {
      game.sheriffElectionDone = true;
      if (game.sheriffElection) {
        game.sheriffElection.phase = 'done';
      }
      return { winner: null, isTie: false };
    }

    // 找出最高票数
    const maxVotes = Math.max(...voteCounts.values());

    // 找出所有得票最高的玩家
    const topPlayers: number[] = [];
    voteCounts.forEach((votes, candidateId) => {
      if (votes === maxVotes) {
        topPlayers.push(candidateId);
      }
    });

    // 检查平票情况
    if (topPlayers.length > 1) {
      // 平票：进入 'tie' 阶段，由上帝指定
      game.sheriffElection.phase = 'tie';
      game.sheriffElection.tiedPlayers = topPlayers;
      return { winner: null, isTie: true, tiedPlayers: topPlayers };
    }

    // 单一获胜者
    const winner = topPlayers[0];
    this.electSheriff(game, winner);
    return { winner, isTie: false };
  }

  /**
   * 选举警长
   */
  electSheriff(game: Game, sheriffId: number): void {
    game.players.forEach(p => (p.isSheriff = false));

    const sheriff = game.players.find(p => p.playerId === sheriffId);
    if (sheriff) {
      sheriff.isSheriff = true;
      game.sheriffId = sheriffId;
      game.sheriffBadgeState = 'normal';
    }

    game.sheriffElectionDone = true;

    if (game.sheriffElection) {
      game.sheriffElection.phase = 'done';
      game.sheriffElection.result = sheriffId;
    }

    // 清理待处理的传递状态
    game.pendingSheriffTransfer = undefined;
  }

  // ================= 警徽管理系统 =================

  /**
   * 处理警长死亡 - 设置待传递状态
   */
  handleSheriffDeath(game: Game, sheriffId: number, deathReason: string): void {
    if (!game.sheriffId || game.sheriffId !== sheriffId) return;

    // 获取可传递目标（活着的玩家，排除自己）
    const validTargets = game.players
      .filter(p => p.alive && p.playerId !== sheriffId)
      .map(p => p.playerId);

    // 设置待传递状态
    game.sheriffBadgeState = 'pending_transfer';
    game.pendingSheriffTransfer = {
      fromPlayerId: sheriffId,
      options: validTargets,
      reason: deathReason === 'self_destruct' ? 'wolf_explosion' : 'death',
    };
  }

  /**
   * 传递警徽给另一个玩家
   */
  transferSheriffBadge(game: Game, targetId: number): boolean {
    if (!game.pendingSheriffTransfer) return false;

    // 验证目标在可选范围内
    if (!game.pendingSheriffTransfer.options.includes(targetId)) {
      return false;
    }

    // 传递警徽
    game.players.forEach(p => (p.isSheriff = false));
    const newSheriff = game.players.find(p => p.playerId === targetId);
    if (newSheriff && newSheriff.alive) {
      newSheriff.isSheriff = true;
      game.sheriffId = targetId;
      game.sheriffBadgeState = 'normal';
      game.pendingSheriffTransfer = undefined;
      return true;
    }

    return false;
  }

  /**
   * 撕毁警徽
   */
  destroySheriffBadge(game: Game): boolean {
    if (!game.pendingSheriffTransfer && game.sheriffBadgeState !== 'pending_assign') {
      return false;
    }

    game.players.forEach(p => (p.isSheriff = false));
    game.sheriffId = 0;
    game.sheriffBadgeState = 'destroyed';
    game.pendingSheriffTransfer = undefined;

    // 如果是警长竞选平票导致的，也需要完成竞选
    if (game.sheriffElection && game.sheriffElection.phase === 'tie') {
      game.sheriffElection.phase = 'done';
      game.sheriffElectionDone = true;
    }

    return true;
  }

  /**
   * 上帝指定警长（适用于狼人自爆和平票场景）
   */
  godAssignSheriff(game: Game, targetId: number | 'none'): boolean {
    // 验证状态
    const isValidState = game.sheriffBadgeState === 'pending_assign' ||
      (game.sheriffElection && game.sheriffElection.phase === 'tie');

    if (!isValidState) return false;

    if (targetId === 'none') {
      // 上帝选择不给警徽
      return this.destroySheriffBadge(game);
    }

    // 验证目标是否有效
    const target = game.players.find(p => p.playerId === targetId);
    if (!target || !target.alive) return false;

    // 如果是平票场景，验证目标是否在平票玩家中
    if (game.sheriffElection?.phase === 'tie' && game.sheriffElection.tiedPlayers) {
      if (!game.sheriffElection.tiedPlayers.includes(targetId)) {
        return false;
      }
    }

    // 指定警长
    game.players.forEach(p => (p.isSheriff = false));
    target.isSheriff = true;
    game.sheriffId = targetId;
    game.sheriffBadgeState = 'normal';
    game.pendingSheriffTransfer = undefined;

    // 完成警长竞选
    if (game.sheriffElection) {
      game.sheriffElection.phase = 'done';
      game.sheriffElection.result = targetId;
    }
    game.sheriffElectionDone = true;

    return true;
  }

  // ================= 放逐投票系统 =================

  /**
   * 开始放逐投票
   */
  startExileVote(game: Game): void {
    game.exileVote = {
      phase: 'voting',
      votes: {},
    };
  }

  /**
   * 放逐投票
   */
  voteForExile(game: Game, voterId: number, targetId: number | 'skip'): boolean {
    if (!game.exileVote || game.exileVote.phase !== 'voting') {
      return false;
    }

    const voter = game.players.find(p => p.playerId === voterId);
    if (!voter || !voter.alive) return false;

    // 只能投给活着的玩家
    if (targetId !== 'skip') {
      const target = game.players.find(p => p.playerId === targetId);
      if (!target || !target.alive) return false;
    }

    game.exileVote.votes[voterId] = targetId;
    return true;
  }

  /**
   * 统计放逐投票结果
   */
  tallyExileVotes(game: Game): { result: number | 'tie' | 'none'; pkPlayers?: number[] } {
    if (!game.exileVote) {
      return { result: 'none' };
    }

    const voteCounts = new Map<number, number>();

    Object.entries(game.exileVote.votes).forEach(([voterIdStr, targetId]) => {
      if (targetId === 'skip') return;

      const voterId = Number(voterIdStr);
      const voter = game.players.find(p => p.playerId === voterId);

      // 警长有1.5票权重
      const voteWeight = voter?.isSheriff ? 1.5 : 1;

      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + voteWeight);
    });

    if (voteCounts.size === 0) {
      return { result: 'none' };
    }

    // 找出最高票数
    let maxVotes = 0;
    voteCounts.forEach(votes => {
      if (votes > maxVotes) {
        maxVotes = votes;
      }
    });

    // 找出所有得票最高的玩家
    const topPlayers: number[] = [];
    voteCounts.forEach((votes, playerId) => {
      if (votes === maxVotes) {
        topPlayers.push(playerId);
      }
    });

    // 平票
    if (topPlayers.length > 1) {
      game.exileVote.phase = 'pk';
      game.exileVote.pkPlayers = topPlayers;
      return { result: 'tie', pkPlayers: topPlayers };
    }

    // 单一出局者
    const exiled = topPlayers[0];
    game.exileVote.phase = 'done';
    game.exileVote.result = exiled;
    return { result: exiled };
  }

  /**
   * 开始平票PK投票
   */
  startExilePKVote(game: Game): boolean {
    if (!game.exileVote || game.exileVote.phase !== 'pk') {
      return false;
    }

    game.exileVote.pkVotes = {};
    return true;
  }

  /**
   * 平票PK投票
   */
  voteForExilePK(game: Game, voterId: number, targetId: number | 'skip'): boolean {
    if (!game.exileVote || game.exileVote.phase !== 'pk' || !game.exileVote.pkPlayers) {
      return false;
    }

    const voter = game.players.find(p => p.playerId === voterId);
    if (!voter || !voter.alive) return false;

    // PK玩家不能投票
    if (game.exileVote.pkPlayers.includes(voterId)) {
      return false;
    }

    // 只能投给PK玩家
    if (targetId !== 'skip' && !game.exileVote.pkPlayers.includes(targetId)) {
      return false;
    }

    if (!game.exileVote.pkVotes) {
      game.exileVote.pkVotes = {};
    }

    game.exileVote.pkVotes[voterId] = targetId;
    return true;
  }

  /**
   * 统计PK投票结果
   */
  tallyExilePKVotes(game: Game): number | 'none' {
    if (!game.exileVote || !game.exileVote.pkVotes) {
      return 'none';
    }

    const voteCounts = new Map<number, number>();

    Object.entries(game.exileVote.pkVotes).forEach(([voterIdStr, targetId]) => {
      if (targetId === 'skip') return;

      const voterId = Number(voterIdStr);
      const voter = game.players.find(p => p.playerId === voterId);

      const voteWeight = voter?.isSheriff ? 1.5 : 1;

      voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + voteWeight);
    });

    if (voteCounts.size === 0) {
      return 'none';
    }

    // 找出最高票数
    let maxVotes = 0;
    let winner: number | null = null;

    voteCounts.forEach((votes, playerId) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = playerId;
      }
    });

    if (winner) {
      game.exileVote.phase = 'done';
      game.exileVote.result = winner;
      return winner;
    }

    // 再次平票,无人出局
    game.exileVote.phase = 'done';
    game.exileVote.result = 'none';
    return 'none';
  }

  /**
   * 执行放逐
   */
  executeExile(game: Game, playerId: number): void {
    const player = game.players.find(p => p.playerId === playerId);
    if (player && player.alive) {
      player.alive = false;
      player.outReason = DeathReason.EXILE;
    }
  }
}
