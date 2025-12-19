import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Game, GamePlayer, ActionLog, GamePhase, PlayerAction } from '../../../shared/src/types.js';
import { ROOM_CODE_LENGTH, PHASES } from '../../../shared/src/constants.js';
import { ScriptService } from './ScriptService.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');

export class GameService {
  private games: Game[] = [];
  private scriptService: ScriptService;

  constructor(scriptService: ScriptService) {
    this.scriptService = scriptService;
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
    const script = this.scriptService.getScript(scriptId);
    if (!script) return null;

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

    const script = this.scriptService.getScript(game.scriptId);
    if (!script) return null;

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

    const script = this.scriptService.getScript(game.scriptId);
    if (!script) return false;

    for (const assignment of assignments) {
      const player = game.players.find(p => p.playerId === assignment.playerId);
      const roleConfig = script.roles.find(r => r.id === assignment.roleId);
      if (!player || !roleConfig) return false;

      player.role = roleConfig.name;
      player.camp = roleConfig.camp;

      // 初始化角色技能
      if (roleConfig.id === 'witch') {
        player.abilities.antidote = true;
        player.abilities.poison = true;
      }
    }

    await this.saveGames();
    return true;
  }

  async startGame(gameId: string): Promise<boolean> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'waiting') return false;

    const script = this.scriptService.getScript(game.scriptId);
    if (!script) return false;

    if (game.players.length !== script.playerCount) return false;
    if (game.players.some(p => !p.role)) return false;

    game.status = 'running';
    game.currentRound = 1;
    game.currentPhase = 'fear';
    game.startedAt = new Date().toISOString();

    await this.saveGames();
    return true;
  }

  async submitAction(gameId: string, action: PlayerAction): Promise<{ success: boolean; message: string; data?: any }> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'running') {
      return { success: false, message: '游戏不存在或未开始' };
    }

    const player = game.players.find(p => p.playerId === action.playerId);
    if (!player || !player.alive) {
      return { success: false, message: '玩家不存在或已出局' };
    }

    let responseData: any = {};

    // 根据不同阶段处理操作
    switch (action.phase) {
      case 'fear':
        game.nightActions.fear = action.target;
        game.nightActions.fearSubmitted = true;
        break;
      case 'dream':
        game.nightActions.dream = action.target;
        game.nightActions.dreamSubmitted = true;
        break;
      case 'wolf':
        game.nightActions.wolfKill = action.target;
        game.nightActions.wolfSubmitted = true;
        break;
      case 'witch':
        game.nightActions.witchAction = action.actionType as 'none' | 'save' | 'poison';
        game.nightActions.witchTarget = action.target;
        game.nightActions.witchSubmitted = true;
        // 女巫知道被刀的人
        if (!game.nightActions.witchKnowsVictim && game.nightActions.wolfKill) {
          game.nightActions.witchKnowsVictim = game.nightActions.wolfKill;
          responseData.victimInfo = game.nightActions.wolfKill;
        }
        break;
      case 'seer':
        if (action.target) {
          game.nightActions.seerCheck = action.target;
          const target = game.players.find(p => p.playerId === action.target);
          if (target) {
            game.nightActions.seerResult = target.camp === 'wolf' ? 'wolf' : 'good';
            responseData.seerResult = {
              playerId: action.target,
              result: game.nightActions.seerResult,
              message: `${action.target}号是${game.nightActions.seerResult === 'wolf' ? '狼人' : '好人'}`
            };
          }
        }
        game.nightActions.seerSubmitted = true;
        break;
      default:
        return { success: false, message: '无效的操作阶段' };
    }

    const log: ActionLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      round: game.currentRound,
      phase: action.phase,
      actorId: player.userId,
      actorPlayerId: player.playerId,
      action: action.actionType,
      target: action.target,
      result: `${player.playerId}号完成操作`,
      visible: 'god',
    };

    game.history.push(log);
    await this.saveGames();

    return { success: true, message: '操作成功', data: responseData };
  }

  async advancePhase(gameId: string): Promise<{ success: boolean; nextPhase: GamePhase; prompt: string }> {
    const game = this.getGame(gameId);
    if (!game || game.status !== 'running') {
      return { success: false, nextPhase: 'lobby', prompt: '游戏不存在或未开始' };
    }

    const script = this.scriptService.getScript(game.scriptId);
    if (!script) {
      return { success: false, nextPhase: 'lobby', prompt: '剧本不存在' };
    }

    const currentPhaseConfig = script.phases.find(p => p.id === game.currentPhase);
    if (!currentPhaseConfig) {
      return { success: false, nextPhase: 'lobby', prompt: '当前阶段配置错误' };
    }

    // 找到下一个阶段
    const nextPhaseConfig = script.phases.find(p => p.order === currentPhaseConfig.order + 1);
    if (!nextPhaseConfig) {
      return { success: false, nextPhase: 'lobby', prompt: '没有下一个阶段' };
    }

    // 特殊处理：夜间结算
    if (game.currentPhase === 'seer') {
      await this.settleNight(game);
    }

    // 特殊处理：警长竞选（仅第一轮）
    if (nextPhaseConfig.id === 'sheriffElection' && game.sheriffElectionDone) {
      const votePhase = script.phases.find(p => p.id === 'vote');
      if (votePhase) {
        game.currentPhase = 'vote';
        await this.saveGames();
        return { success: true, nextPhase: 'vote', prompt: '进入投票放逐阶段' };
      }
    }

    game.currentPhase = nextPhaseConfig.id;

    // 检查游戏是否结束
    const winner = this.checkWinner(game);
    if (winner) {
      game.status = 'finished';
      game.currentPhase = 'finished';
      game.winner = winner;
      game.finishedAt = new Date().toISOString();
    }

    await this.saveGames();
    return { success: true, nextPhase: game.currentPhase, prompt: nextPhaseConfig.description };
  }

  private async settleNight(game: Game) {
    const deaths: number[] = [];
    const { fear, dream, wolfKill, witchAction, witchTarget } = game.nightActions;

    // 处理狼刀
    let actualKill = wolfKill || 0;

    // 摄梦人守护
    if (dream && dream === actualKill) {
      const dreamer = game.players.find(p => p.role === '摄梦人');
      if (dreamer && dreamer.alive) {
        dreamer.alive = false;
        dreamer.outReason = 'dreamerKilled';
        deaths.push(dreamer.playerId);
        actualKill = 0; // 被守护者不死
      }
    }

    // 女巫救人
    if (witchAction === 'save' && actualKill) {
      const witch = game.players.find(p => p.role === '女巫');
      if (witch) {
        witch.abilities.antidote = false;
      }
      actualKill = 0;
    }

    // 狼刀生效
    if (actualKill) {
      const victim = game.players.find(p => p.playerId === actualKill);
      if (victim && victim.alive) {
        victim.alive = false;
        victim.outReason = 'wolfKill';
        deaths.push(victim.playerId);
      }
    }

    // 女巫毒人
    if (witchAction === 'poison' && witchTarget) {
      const victim = game.players.find(p => p.playerId === witchTarget);
      if (victim && victim.alive) {
        victim.alive = false;
        victim.outReason = 'poison';
        deaths.push(victim.playerId);
        const witch = game.players.find(p => p.role === '女巫');
        if (witch) {
          witch.abilities.poison = false;
        }
      }
    }

    // 记录结算日志
    const log: ActionLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      round: game.currentRound,
      phase: 'settle',
      actorId: 'system',
      actorPlayerId: 0,
      action: 'settle',
      result: deaths.length > 0 ? `昨晚死亡：${deaths.join('号、')}号` : '昨晚平安夜',
      visible: 'all',
    };

    game.history.push(log);

    // 清空夜间操作
    game.nightActions = {};
  }

  private checkWinner(game: Game): 'wolf' | 'good' | null {
    const aliveWolves = game.players.filter(p => p.alive && p.camp === 'wolf').length;
    const aliveGoods = game.players.filter(p => p.alive && p.camp === 'good').length;

    if (aliveWolves === 0) return 'good';
    if (aliveWolves >= aliveGoods) return 'wolf';
    return null;
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
}
