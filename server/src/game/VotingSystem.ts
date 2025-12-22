import { Game, SheriffElectionState, ExileVoteState } from '../../../shared/src/types.js';

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

    // 重置所有玩家的警长竞选状态
    game.players.forEach(p => {
      p.sheriffCandidate = false;
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

    // 上警的人不能投票
    if (game.sheriffElection.candidates.includes(voterId)) {
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
   */
  tallySheriffVotes(game: Game): number | null {
    if (!game.sheriffElection) return null;

    const voteCounts = new Map<number, number>();

    Object.entries(game.sheriffElection.votes).forEach(([voterIdStr, candidateId]) => {
      if (candidateId === 'skip') return;

      const voterId = Number(voterIdStr);
      const voter = game.players.find(p => p.playerId === voterId);

      // 警长有1.5票权重
      const voteWeight = voter?.isSheriff ? 1.5 : 1;

      voteCounts.set(candidateId, (voteCounts.get(candidateId) || 0) + voteWeight);
    });

    // 找出得票最高者
    let maxVotes = 0;
    let winner: number | null = null;

    voteCounts.forEach((votes, candidateId) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = candidateId;
      }
    });

    if (winner) {
      this.electSheriff(game, winner);
    }

    return winner;
  }

  /**
   * 选举警长
   */
  private electSheriff(game: Game, sheriffId: number): void {
    game.players.forEach(p => (p.isSheriff = false));

    const sheriff = game.players.find(p => p.playerId === sheriffId);
    if (sheriff) {
      sheriff.isSheriff = true;
      game.sheriffId = sheriffId;
    }

    game.sheriffElectionDone = true;

    if (game.sheriffElection) {
      game.sheriffElection.phase = 'done';
      game.sheriffElection.result = sheriffId;
    }
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
      player.outReason = 'exile';
    }
  }
}
