import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Game, GamePlayer, ActionLog, GamePhase, PlayerAction, GamePhaseType } from '../../../shared/src/types.js';
import { ROOM_CODE_LENGTH, PHASES } from '../../../shared/src/constants.js';
import { ScriptService } from './ScriptService.js';
import { VotingSystem } from '../game/VotingSystem.js';
import { RoleRegistry } from '../game/roles/RoleRegistry.js';
import { GameFlowEngine } from '../game/flow/GameFlowEngine.js';
import { BotService } from './BotService.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

export class GameService {
  private games: Game[] = [];
  private scriptService: ScriptService;
  private votingSystem: VotingSystem;
  private gameFlowEngine: GameFlowEngine;
  private botService: BotService;
  private saveQueue: Promise<void> = Promise.resolve();
  private advancingGames: Set<string> = new Set(); // 并发锁：防止自动推进和手动推进竞态

  constructor(scriptService: ScriptService) {
    this.scriptService = scriptService;
    this.votingSystem = new VotingSystem();
    this.gameFlowEngine = new GameFlowEngine(this.votingSystem);
    this.botService = new BotService(this);
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadGames();
    await this.cleanupStaleGames();
  }

  private async loadGames() {
    try {
      const data = await fs.readFile(GAMES_FILE, 'utf-8');
      this.games = JSON.parse(data);
    } catch (error) {
      this.games = [];
    }
  }

  private saveGames(): Promise<void> {
    // 串行化写入，防止并发 WebSocket 事件触发的重叠写入导致文件损坏
    this.saveQueue = this.saveQueue
      .catch(() => {})
      .then(() => fs.writeFile(GAMES_FILE, JSON.stringify(this.games, null, 2)));
    return this.saveQueue;
  }

  /**
   * 清理过期游戏：已结束超过24小时或创建超过48小时的游戏
   */
  private async cleanupStaleGames(): Promise<void> {
    const now = Date.now();
    const FINISHED_TTL = 24 * 60 * 60 * 1000; // 已结束游戏保留24小时
    const ABANDONED_TTL = 48 * 60 * 60 * 1000; // 所有游戏最长保留48小时

    const before = this.games.length;
    this.games = this.games.filter(game => {
      // 已结束的游戏：超过 FINISHED_TTL 则清理
      if (game.status === 'finished' && game.finishedAt) {
        return now - new Date(game.finishedAt).getTime() < FINISHED_TTL;
      }
      // 未结束的游戏：超过 ABANDONED_TTL 则清理
      return now - new Date(game.createdAt).getTime() < ABANDONED_TTL;
    });

    if (this.games.length < before) {
      console.log(`Cleaned up ${before - this.games.length} stale games`);
      await this.saveGames();
    }
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createGame(hostId: string, hostUsername: string, scriptId: string): Promise<Game | null> {
    const scriptWithPhases = this.scriptService.getScript(scriptId);
    if (!scriptWithPhases) return null;

    const { script } = scriptWithPhases;

    let roomCode = this.generateRoomCode();
    while (this.games.some(g => g.roomCode === roomCode)) {
      roomCode = this.generateRoomCode();
    }

    const game: Game = {
      id: uuidv4(),
      roomCode,
      scriptId: script.id,
      scriptName: script.name,
      hostId,
      hostUsername,
      players: [],
      status: 'waiting',
      currentPhase: 'lobby',
      currentPhaseType: 'transition',
      currentRound: 0,
      history: [],
      sheriffId: 0,
      sheriffElectionDone: false,
      nightActions: {},
      createdAt: new Date().toISOString(),
    };

    this.games.push(game);
    await this.saveGames();
    return game;
  }

  /**
   * 创建测试游戏（带12个机器人玩家）
   * 用于快速测试游戏流程
   */
  async createTestGame(hostId: string, hostUsername: string, scriptId: string): Promise<Game | null> {
    const game = await this.createGame(hostId, hostUsername, scriptId);
    if (!game) return null;

    const scriptWithPhases = this.scriptService.getScript(scriptId);
    if (!scriptWithPhases) return null;

    const { script } = scriptWithPhases;

    // 添加12个机器人玩家
    for (let i = 1; i <= script.playerCount; i++) {
      const player: GamePlayer = {
        userId: `bot-${i}`,
        username: `Bot${i}`,
        playerId: i,
        role: '',
        camp: 'good',
        alive: true,
        isSheriff: false,
        abilities: {},
        isBot: true,
      };
      game.players.push(player);
    }

    game.hasBot = true;
    await this.saveGames();
    console.log(`[Test] 创建测试游戏: ${game.roomCode}, 已添加 ${script.playerCount} 个机器人`);
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.find(g => g.id === gameId);
  }

  getGameByRoomCode(roomCode: string): Game | undefined {
    return this.games.find(g => g.roomCode === roomCode.toUpperCase());
  }

  async addPlayer(gameId: string, userId: string, username: string, requestedPlayerId?: number): Promise<GamePlayer | null> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return null;

    const scriptWithPhases = this.scriptService.getScript(game.scriptId);
    if (!scriptWithPhases) return null;

    const { script } = scriptWithPhases;

    if (game.players.length >= script.playerCount) return null;
    if (game.players.some(p => p.userId === userId)) return null;

    // 确定玩家号位
    let playerId: number;
    if (requestedPlayerId !== undefined && requestedPlayerId > 0 && requestedPlayerId <= script.playerCount) {
      // 检查号位是否已被占用
      if (game.players.some(p => p.playerId === requestedPlayerId)) {
        return null; // 号位已被占用
      }
      playerId = requestedPlayerId;
    } else {
      // 自动分配：找到第一个未被使用的号位
      playerId = 1;
      while (game.players.some(p => p.playerId === playerId) && playerId <= script.playerCount) {
        playerId++;
      }
      if (playerId > script.playerCount) {
        return null; // 没有可用号位
      }
    }

    const player: GamePlayer = {
      userId,
      username,
      playerId,
      role: '',
      camp: 'good',
      alive: true,
      isSheriff: false,
      abilities: {},
    };

    game.players.push(player);
    await this.saveGames();
    return player;
  }

  async removePlayer(gameId: string, userId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return false;

    const index = game.players.findIndex(p => p.userId === userId);
    if (index === -1) return false;

    game.players.splice(index, 1);

    await this.saveGames();
    return true;
  }

  async assignRoles(gameId: string, assignments: { playerId: number; roleId: string }[]): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return false;

    const scriptWithPhases = this.scriptService.getScript(game.scriptId);
    if (!scriptWithPhases) return false;

    const { script } = scriptWithPhases;

    for (const assignment of assignments) {
      const player = game.players.find(p => p.playerId === assignment.playerId);
      if (!player) return false;

      // 验证roleId是否在剧本的roleComposition中
      if (!script.roleComposition[assignment.roleId]) {
        return false;
      }

      // 使用角色处理器获取角色信息
      const roleHandler = RoleRegistry.getHandler(assignment.roleId);
      if (!roleHandler) return false;

      player.role = assignment.roleId;
      player.camp = roleHandler.camp;

      // 初始化角色技能
      roleHandler.initializeAbilities(player);
    }

    await this.saveGames();
    return true;
  }

  async startGame(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return false;

    const scriptWithPhases = this.scriptService.getScript(game.scriptId);
    if (!scriptWithPhases) return false;

    const { script, phases } = scriptWithPhases;

    if (game.players.length !== script.playerCount) return false;
    if (game.players.some(p => !p.role)) return false;

    game.status = 'running';
    game.currentRound = 1;

    // 动态确定第一个夜间阶段
    const firstNightPhase = phases.find(p => p.isNightPhase);
    if (firstNightPhase) {
      game.currentPhase = firstNightPhase.id;
      game.currentPhaseType = 'night';
    } else {
      // 如果没有夜间阶段，直接进入白天
      game.currentPhase = 'discussion';
      game.currentPhaseType = 'day';
    }

    game.startedAt = new Date().toISOString();

    await this.saveGames();
    return true;
  }

  async submitAction(gameId: string, action: PlayerAction): Promise<{ success: boolean; message: string; data?: any }> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'running') {
      return { success: false, message: '游戏不存在或未开始' };
    }

    // 使用GameFlowEngine处理行动
    const result = await this.gameFlowEngine.submitAction(game, action);

    // 保存游戏状态
    await this.saveGames();

    return result;
  }

  async advancePhase(gameId: string): Promise<{ success: boolean; nextPhase: GamePhase; prompt: string }> {
    // 并发锁保护
    if (this.advancingGames.has(gameId)) {
      return { success: false, nextPhase: 'lobby', prompt: '阶段正在推进中' };
    }
    this.advancingGames.add(gameId);

    try {
      const game = this.getGame(gameId);
      if (!game || game.status !== 'running') {
        return { success: false, nextPhase: 'lobby', prompt: '游戏不存在或未开始' };
      }

      const scriptWithPhases = this.scriptService.getScript(game.scriptId);
      if (!scriptWithPhases) {
        return { success: false, nextPhase: 'lobby', prompt: '剧本不存在' };
      }

      const { phases } = scriptWithPhases;

      // 使用GameFlowEngine推进阶段
      const result = await this.gameFlowEngine.advancePhase(game, phases);

      // 保存游戏状态
      await this.saveGames();

      // 如果游戏结束，返回结束信息
      if (result.finished) {
        return {
          success: true,
          nextPhase: 'finished',
          prompt: result.message || '游戏结束',
        };
      }

      // 如果游戏有机器人，自动执行机器人行动
      if (game.hasBot && game.status === 'running') {
        const newPhase = result.phase as GamePhase;
        await this.botService.executeBotActionsForPhase(game, newPhase);
        // 再次保存（机器人行动后状态可能变化）
        await this.saveGames();
      }

      return {
        success: true,
        nextPhase: result.phase as GamePhase,
        prompt: result.prompt || '进入下一阶段',
      };
    } finally {
      this.advancingGames.delete(gameId);
    }
  }

  /**
   * 检查当前阶段是否完成并自动推进
   * 在玩家提交操作/投票后调用
   */
  async checkAndAutoAdvance(gameId: string): Promise<{
    advanced: boolean;
    nextPhase?: GamePhase;
    prompt?: string;
    reason?: string;
    finished?: boolean;
  }> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'running') {
      return { advanced: false };
    }

    // 检查自动推进是否启用（默认启用）
    if (game.autoAdvanceEnabled === false) {
      return { advanced: false };
    }

    // 并发锁保护
    if (this.advancingGames.has(gameId)) {
      return { advanced: false };
    }

    const check = this.gameFlowEngine.checkPhaseComplete(game);
    if (!check.shouldAdvance) {
      return { advanced: false };
    }

    // 满足条件，执行推进（复用 advancePhase 逻辑）
    const result = await this.advancePhase(gameId);
    if (!result.success) {
      return { advanced: false };
    }

    return {
      advanced: true,
      nextPhase: result.nextPhase,
      prompt: result.prompt,
      reason: check.reason,
      finished: result.nextPhase === 'finished',
    };
  }

  listGames(): Game[] {
    return this.games;
  }

  async deleteGame(gameId: string): Promise<boolean> {
    const index = this.games.findIndex(g => g.id === gameId);
    if (index === -1) return false;

    this.games.splice(index, 1);
    await this.saveGames();
    return true;
  }

  // ================= 警长竞选相关方法 =================

  async startSheriffElection(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    this.votingSystem.startSheriffElection(game);
    await this.saveGames();
    return true;
  }

  async sheriffSignup(gameId: string, playerId: number, runForSheriff: boolean): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.sheriffSignup(game, playerId, runForSheriff);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async startSheriffCampaign(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.startSheriffCampaign(game);
    await this.saveGames();
    return result;
  }

  async sheriffWithdraw(gameId: string, playerId: number): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.sheriffWithdraw(game, playerId);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async startSheriffVoting(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.startSheriffVoting(game);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async voteForSheriff(gameId: string, voterId: number, candidateId: number | 'skip'): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.voteForSheriff(game, voterId, candidateId);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async tallySheriffVotes(gameId: string): Promise<{ winner: number | null; isTie: boolean; tiedPlayers?: number[] }> {
    const game = this.getGame(gameId);
    if (!game) return { winner: null, isTie: false };

    const result = this.votingSystem.tallySheriffVotes(game);
    // 保存警长选举数据到回合历史（含投票明细和加权计票结果）
    this.gameFlowEngine.saveSheriffElectionToHistory(game);
    await this.saveGames();
    return result;
  }

  // ================= 警徽管理相关方法 =================

  async handleSheriffDeath(gameId: string, sheriffId: number, deathReason: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    this.votingSystem.handleSheriffDeath(game, sheriffId, deathReason);
    await this.saveGames();
    return true;
  }

  async resolveDeathTrigger(gameId: string, triggerId: string, targetId: number | 'skip'): Promise<{ success: boolean; message: string }> {
    const game = this.getGame(gameId);
    if (!game) return { success: false, message: '游戏不存在' };

    const trigger = game.pendingDeathTriggers?.find(t => t.id === triggerId && !t.resolved);
    if (!trigger) return { success: false, message: '无效的死亡触发' };

    trigger.resolved = true;

    if (targetId === 'skip') {
      const label = trigger.type === 'hunter_shoot' ? '猎人放弃开枪' : '黑狼王放弃爆炸';
      game.history.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        round: game.currentRound,
        phase: game.currentPhase,
        actorId: 'god',
        actorPlayerId: trigger.actorId,
        action: label,
        result: label,
        visible: 'god',
      });
    } else {
      const targetPlayer = game.players.find(p => p.playerId === targetId);
      if (!targetPlayer || !targetPlayer.alive) {
        trigger.resolved = false;
        return { success: false, message: '目标无效' };
      }

      trigger.targetId = targetId;
      targetPlayer.alive = false;
      targetPlayer.outReason = trigger.type === 'hunter_shoot' ? 'hunter_shoot' : 'black_wolf_explode';

      if (targetPlayer.isSheriff) {
        this.votingSystem.handleSheriffDeath(game, targetId, trigger.type);
      }

      const label = trigger.type === 'hunter_shoot'
        ? `${trigger.actorId}号猎人开枪带走${targetId}号`
        : `${trigger.actorId}号黑狼王爆炸带走${targetId}号`;

      game.history.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        round: game.currentRound,
        phase: game.currentPhase,
        actorId: 'god',
        actorPlayerId: trigger.actorId,
        action: label,
        target: targetId,
        result: label,
        visible: 'god',
      });
    }

    await this.saveGames();
    return { success: true, message: '操作成功' };
  }

  async transferSheriffBadge(gameId: string, targetId: number): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    // 保存移交前的信息（transfer 后 pendingSheriffTransfer 会被清除）
    const fromPlayerId = game.pendingSheriffTransfer?.fromPlayerId;
    const reason = game.pendingSheriffTransfer?.reason || 'death';

    const result = this.votingSystem.transferSheriffBadge(game, targetId);
    if (result && fromPlayerId) {
      this.saveSheriffTransferToHistory(game, fromPlayerId, targetId, reason);
      await this.saveGames();
    }
    return result;
  }

  async destroySheriffBadge(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    // 保存流失前的信息
    const fromPlayerId = game.pendingSheriffTransfer?.fromPlayerId;
    const reason = game.pendingSheriffTransfer?.reason || 'death';

    const result = this.votingSystem.destroySheriffBadge(game);
    if (result && fromPlayerId) {
      this.saveSheriffTransferToHistory(game, fromPlayerId, 'destroyed', reason);
      await this.saveGames();
    } else if (result) {
      await this.saveGames();
    }
    return result;
  }

  /**
   * 保存警徽移交记录到当前回合历史
   */
  private saveSheriffTransferToHistory(game: Game, fromPlayerId: number, toPlayerId: number | 'destroyed', reason: string): void {
    if (!game.roundHistory) game.roundHistory = [];
    const entry = game.roundHistory.find(h => h.round === game.currentRound);
    const record = { fromPlayerId, toPlayerId, reason };
    if (entry) {
      if (!entry.sheriffTransfers) entry.sheriffTransfers = [];
      entry.sheriffTransfers.push(record);
    } else {
      game.roundHistory.push({
        round: game.currentRound,
        nightActions: {} as any,
        deaths: [],
        sheriffTransfers: [record],
      });
    }
  }

  async godAssignSheriff(gameId: string, targetId: number | 'none'): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.godAssignSheriff(game, targetId);
    if (result) {
      // 保存警长选举数据到回合历史（含上帝指定结果）
      this.gameFlowEngine.saveSheriffElectionToHistory(game);
      await this.saveGames();
    }
    return result;
  }

  // ================= 放逐投票相关方法 =================

  async startExileVote(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    this.votingSystem.startExileVote(game);
    await this.saveGames();
    return true;
  }

  async voteForExile(gameId: string, voterId: number, targetId: number | 'skip'): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.voteForExile(game, voterId, targetId);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async tallyExileVotes(gameId: string): Promise<{ result: number | 'tie' | 'none'; pkPlayers?: number[] }> {
    const game = this.getGame(gameId);
    if (!game) return { result: 'none' };

    const result = this.votingSystem.tallyExileVotes(game);
    await this.saveGames();
    return result;
  }

  async startExilePKVote(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.startExilePKVote(game);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async voteForExilePK(gameId: string, voterId: number, targetId: number | 'skip'): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    const result = this.votingSystem.voteForExilePK(game, voterId, targetId);
    if (result) {
      await this.saveGames();
    }
    return result;
  }

  async tallyExilePKVotes(gameId: string): Promise<number | 'none'> {
    const game = this.getGame(gameId);
    if (!game) return 'none';

    const result = this.votingSystem.tallyExilePKVotes(game);
    await this.saveGames();
    return result;
  }

  async executeExile(gameId: string, playerId: number): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game) return false;

    this.votingSystem.executeExile(game, playerId);
    await this.saveGames();
    return true;
  }

  // ================= 机器人行为相关 =================

  /**
   * 执行机器人当前阶段的行动（用于游戏开始后的第一个阶段）
   */
  async executeBotActionsForCurrentPhase(gameId: string): Promise<void> {
    const game = this.getGame(gameId);
    if (!game || !game.hasBot || game.status !== 'running') return;

    await this.botService.executeBotActionsForPhase(game, game.currentPhase as GamePhase);
    await this.saveGames();
  }

  /**
   * 执行机器人警长竞选上警
   */
  async executeBotSheriffSignup(gameId: string): Promise<void> {
    const game = this.getGame(gameId);
    if (!game) return;

    await this.botService.executeBotSheriffSignup(game);
    await this.saveGames();
  }

  /**
   * 执行机器人警长竞选退水
   */
  async executeBotSheriffWithdraw(gameId: string): Promise<void> {
    const game = this.getGame(gameId);
    if (!game) return;

    await this.botService.executeBotSheriffWithdraw(game);
    await this.saveGames();
  }

  /**
   * 执行机器人警长投票
   */
  async executeBotSheriffVote(gameId: string): Promise<void> {
    const game = this.getGame(gameId);
    if (!game) return;

    await this.botService.executeBotSheriffVote(game);
    await this.saveGames();
  }

  /**
   * 执行机器人放逐投票
   */
  async executeBotExileVote(gameId: string): Promise<void> {
    const game = this.getGame(gameId);
    if (!game) return;

    await this.botService.executeBotExileVote(game);
    await this.saveGames();
  }
}
