import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Game, GamePlayer, ActionLog, GamePhase, PlayerAction, GamePhaseType } from '../../../shared/src/types.js';
import { ROOM_CODE_LENGTH, PHASES } from '../../../shared/src/constants.js';
import { ScriptService } from './ScriptService.js';
import { VotingSystem } from '../game/VotingSystem.js';
import { RoleRegistry } from '../game/roles/RoleRegistry.js';
import { GameFlowEngine } from '../game/flow/GameFlowEngine.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

export class GameService {
  private games: Game[] = [];
  private scriptService: ScriptService;
  private votingSystem: VotingSystem;
  private gameFlowEngine: GameFlowEngine;

  constructor(scriptService: ScriptService) {
    this.scriptService = scriptService;
    this.votingSystem = new VotingSystem();
    this.gameFlowEngine = new GameFlowEngine();
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadGames();
  }

  private async loadGames() {
    try {
      const data = await fs.readFile(GAMES_FILE, 'utf-8');
      this.games = JSON.parse(data);
    } catch (error) {
      this.games = [];
    }
  }

  private async saveGames() {
    await fs.writeFile(GAMES_FILE, JSON.stringify(this.games, null, 2));
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

  getGame(gameId: string): Game | undefined {
    return this.games.find(g => g.id === gameId);
  }

  getGameByRoomCode(roomCode: string): Game | undefined {
    return this.games.find(g => g.roomCode === roomCode.toUpperCase());
  }

  async addPlayer(gameId: string, userId: string, username: string): Promise<GamePlayer | null> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return null;

    const scriptWithPhases = this.scriptService.getScript(game.scriptId);
    if (!scriptWithPhases) return null;

    const { script } = scriptWithPhases;

    if (game.players.length >= script.playerCount) return null;
    if (game.players.some(p => p.userId === userId)) return null;

    const playerId = game.players.length + 1;
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
    // 重新分配号位
    game.players.forEach((p, i) => {
      p.playerId = i + 1;
    });

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

    return {
      success: true,
      nextPhase: result.phase as GamePhase,
      prompt: result.prompt || '进入下一阶段',
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

  async tallySheriffVotes(gameId: string): Promise<number | null> {
    const game = this.getGame(gameId);
    if (!game) return null;

    const winner = this.votingSystem.tallySheriffVotes(game);
    if (winner) {
      await this.saveGames();
    }
    return winner;
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
}
