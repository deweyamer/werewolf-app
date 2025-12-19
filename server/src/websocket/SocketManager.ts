import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ClientMessage, ServerMessage, UserSession } from '../../../shared/src/types.js';
import { AuthService } from '../services/AuthService.js';
import { GameService } from '../services/GameService.js';
import { ScriptService } from '../services/ScriptService.js';

export class SocketManager {
  private io: SocketIOServer;
  private authService: AuthService;
  private gameService: GameService;
  private scriptService: ScriptService;
  private userSockets: Map<string, Socket> = new Map();
  private socketUsers: Map<string, UserSession> = new Map();

  constructor(
    httpServer: HTTPServer,
    authService: AuthService,
    gameService: GameService,
    scriptService: ScriptService
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.authService = authService;
    this.gameService = gameService;
    this.scriptService = scriptService;

    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      const send = (message: ServerMessage) => {
        socket.emit('message', message);
      };

      send({ type: 'CONNECTED', sessionId: socket.id });

      socket.on('message', async (message: ClientMessage) => {
        try {
          await this.handleMessage(socket, message, send);
        } catch (error) {
          console.error('Error handling message:', error);
          send({ type: 'ERROR', message: '服务器内部错误' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        const user = this.socketUsers.get(socket.id);
        if (user) {
          this.userSockets.delete(user.userId);
          this.socketUsers.delete(socket.id);
        }
      });
    });
  }

  private async handleMessage(
    socket: Socket,
    message: ClientMessage,
    send: (msg: ServerMessage) => void
  ) {
    switch (message.type) {
      case 'AUTH':
        await this.handleAuth(socket, message.token, send);
        break;

      case 'CREATE_ROOM':
        await this.handleCreateRoom(socket, message.scriptId, send);
        break;

      case 'JOIN_ROOM':
        await this.handleJoinRoom(socket, message.roomCode, send);
        break;

      case 'LEAVE_ROOM':
        await this.handleLeaveRoom(socket, send);
        break;

      case 'GOD_ASSIGN_ROLES':
        await this.handleAssignRoles(socket, message.assignments, send);
        break;

      case 'GOD_START_GAME':
        await this.handleStartGame(socket, send);
        break;

      case 'GOD_ADVANCE_PHASE':
        await this.handleAdvancePhase(socket, send);
        break;

      case 'PLAYER_SUBMIT_ACTION':
        await this.handlePlayerAction(socket, message.action, send);
        break;

      case 'SHERIFF_ELECT':
        await this.handleSheriffElect(socket, message.sheriffId, send);
        break;

      default:
        send({ type: 'ERROR', message: '未知的消息类型' });
    }
  }

  private async handleAuth(socket: Socket, token: string, send: (msg: ServerMessage) => void) {
    const user = await this.authService.validateToken(token);
    if (!user) {
      send({ type: 'AUTH_FAILED', message: '无效的Token' });
      return;
    }

    this.userSockets.set(user.userId, socket);
    this.socketUsers.set(socket.id, user);
    send({ type: 'AUTH_SUCCESS', user });
  }

  private async handleCreateRoom(socket: Socket, scriptId: string, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const game = await this.gameService.createGame(user.userId, user.username, scriptId);
    if (!game) {
      send({ type: 'ERROR', message: '创建房间失败' });
      return;
    }

    socket.join(game.id);
    send({ type: 'ROOM_CREATED', roomCode: game.roomCode, gameId: game.id });
    send({ type: 'GAME_STATE_UPDATE', game });
  }

  private async handleJoinRoom(socket: Socket, roomCode: string, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user) {
      send({ type: 'ERROR', message: '需要先认证' });
      return;
    }

    const game = this.gameService.getGameByRoomCode(roomCode);
    if (!game) {
      send({ type: 'ERROR', message: '房间不存在' });
      return;
    }

    if (user.role === 'player') {
      const player = await this.gameService.addPlayer(game.id, user.userId, user.username);
      if (!player) {
        send({ type: 'ERROR', message: '加入房间失败' });
        return;
      }

      socket.join(game.id);
      send({ type: 'ROOM_JOINED', game });
      this.io.to(game.id).emit('message', { type: 'PLAYER_JOINED', player } as ServerMessage);
    } else if (user.role === 'god' && user.userId === game.hostId) {
      socket.join(game.id);
      send({ type: 'ROOM_JOINED', game });
    } else {
      send({ type: 'ERROR', message: '无权限加入此房间' });
    }
  }

  private async handleLeaveRoom(socket: Socket, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user) return;

    const rooms = Array.from(socket.rooms);
    for (const roomId of rooms) {
      if (roomId === socket.id) continue;

      const game = this.gameService.getGame(roomId);
      if (game) {
        const player = game.players.find(p => p.userId === user.userId);
        if (player) {
          await this.gameService.removePlayer(game.id, user.userId);
          this.io.to(game.id).emit('message', { type: 'PLAYER_LEFT', playerId: player.playerId } as ServerMessage);
        }
        socket.leave(roomId);
      }
    }

    send({ type: 'ROOM_LEFT' });
  }

  private async handleAssignRoles(
    socket: Socket,
    assignments: { playerId: number; roleId: string }[],
    send: (msg: ServerMessage) => void
  ) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const rooms = Array.from(socket.rooms);
    const gameRoom = rooms.find(r => r !== socket.id);
    if (!gameRoom) {
      send({ type: 'ERROR', message: '未加入房间' });
      return;
    }

    const game = this.gameService.getGame(gameRoom);
    if (!game || game.hostId !== user.userId) {
      send({ type: 'ERROR', message: '权限不足' });
      return;
    }

    const success = await this.gameService.assignRoles(game.id, assignments);
    if (!success) {
      send({ type: 'ERROR', message: '分配角色失败' });
      return;
    }

    const updatedGame = this.gameService.getGame(game.id);
    if (!updatedGame) return;

    // 通知每个玩家他们的角色
    for (const player of updatedGame.players) {
      const playerSocket = this.userSockets.get(player.userId);
      if (playerSocket) {
        playerSocket.emit('message', {
          type: 'ROLE_ASSIGNED',
          playerId: player.playerId,
          role: player.role,
          camp: player.camp,
        } as ServerMessage);
      }
    }

    this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
  }

  private async handleStartGame(socket: Socket, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const rooms = Array.from(socket.rooms);
    const gameRoom = rooms.find(r => r !== socket.id);
    if (!gameRoom) {
      send({ type: 'ERROR', message: '未加入房间' });
      return;
    }

    const game = this.gameService.getGame(gameRoom);
    if (!game || game.hostId !== user.userId) {
      send({ type: 'ERROR', message: '权限不足' });
      return;
    }

    const success = await this.gameService.startGame(game.id);
    if (!success) {
      send({ type: 'ERROR', message: '开始游戏失败' });
      return;
    }

    const updatedGame = this.gameService.getGame(game.id);
    if (!updatedGame) return;

    this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
    this.io.to(game.id).emit('message', {
      type: 'ROUND_STARTED',
      round: updatedGame.currentRound,
    } as ServerMessage);
    this.io.to(game.id).emit('message', {
      type: 'PHASE_CHANGED',
      phase: updatedGame.currentPhase,
      prompt: '恐惧阶段：噩梦之影行动',
    } as ServerMessage);
  }

  private async handleAdvancePhase(socket: Socket, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const rooms = Array.from(socket.rooms);
    const gameRoom = rooms.find(r => r !== socket.id);
    if (!gameRoom) {
      send({ type: 'ERROR', message: '未加入房间' });
      return;
    }

    const game = this.gameService.getGame(gameRoom);
    if (!game || game.hostId !== user.userId) {
      send({ type: 'ERROR', message: '权限不足' });
      return;
    }

    const result = await this.gameService.advancePhase(game.id);
    if (!result.success) {
      send({ type: 'ERROR', message: result.prompt });
      return;
    }

    const updatedGame = this.gameService.getGame(game.id);
    if (!updatedGame) return;

    this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
    this.io.to(game.id).emit('message', {
      type: 'PHASE_CHANGED',
      phase: result.nextPhase,
      prompt: result.prompt,
    } as ServerMessage);

    if (updatedGame.status === 'finished') {
      this.io.to(game.id).emit('message', {
        type: 'GAME_FINISHED',
        winner: updatedGame.winner!,
      } as ServerMessage);
    }
  }

  private async handlePlayerAction(
    socket: Socket,
    action: any,
    send: (msg: ServerMessage) => void
  ) {
    const user = this.socketUsers.get(socket.id);
    if (!user) {
      send({ type: 'ERROR', message: '需要先认证' });
      return;
    }

    const rooms = Array.from(socket.rooms);
    const gameRoom = rooms.find(r => r !== socket.id);
    if (!gameRoom) {
      send({ type: 'ERROR', message: '未加入房间' });
      return;
    }

    const game = this.gameService.getGame(gameRoom);
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    const result = await this.gameService.submitAction(game.id, action);

    // 发送操作结果给玩家（包含额外数据，如预言家查验结果）
    send({
      type: 'ACTION_RESULT',
      success: result.success,
      message: result.message,
      data: result.data
    } as any);

    if (result.success) {
      // 通知所有人有玩家提交了操作
      this.io.to(game.id).emit('message', {
        type: 'PLAYER_ACTION_SUBMITTED',
        playerId: action.playerId,
        actionType: action.actionType,
      } as ServerMessage);

      // 更新游戏状态（上帝会看到实时操作信息）
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
      }
    }
  }

  private async handleSheriffElect(
    socket: Socket,
    sheriffId: number,
    send: (msg: ServerMessage) => void
  ) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const rooms = Array.from(socket.rooms);
    const gameRoom = rooms.find(r => r !== socket.id);
    if (!gameRoom) {
      send({ type: 'ERROR', message: '未加入房间' });
      return;
    }

    const game = this.gameService.getGame(gameRoom);
    if (!game || game.hostId !== user.userId) {
      send({ type: 'ERROR', message: '权限不足' });
      return;
    }

    const player = game.players.find(p => p.playerId === sheriffId);
    if (!player || !player.alive) {
      send({ type: 'ERROR', message: '无效的警长候选人' });
      return;
    }

    game.players.forEach(p => (p.isSheriff = false));
    player.isSheriff = true;
    game.sheriffId = sheriffId;
    game.sheriffElectionDone = true;

    const updatedGame = this.gameService.getGame(game.id);
    if (updatedGame) {
      this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
    }

    send({ type: 'ACTION_RESULT', success: true, message: '警长选举完成' });
  }
}
