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
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigin,
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
          // 验证消息基本结构
          if (!message || typeof message !== 'object' || !message.type || typeof message.type !== 'string') {
            send({ type: 'ERROR', message: '无效的消息格式' });
            return;
          }
          await this.handleMessage(socket, message, send);
        } catch (error) {
          console.error('Error handling message:', error);
          send({ type: 'ERROR', message: '服务器内部错误' });
        }
      });

      socket.on('disconnect', async () => {
        console.log(`Client disconnected: ${socket.id}`);
        const user = this.socketUsers.get(socket.id);
        if (user) {
          // 检查用户是否在游戏中
          const rooms = Array.from(socket.rooms);
          for (const roomId of rooms) {
            if (roomId === socket.id) continue;

            const game = this.gameService.getGame(roomId);
            if (game) {
              if (game.status === 'waiting') {
                // 等待中的房间：移除断连玩家并通知其他人
                const player = game.players.find(p => p.userId === user.userId);
                if (player) {
                  await this.gameService.removePlayer(game.id, user.userId);
                  this.io.to(game.id).emit('message', { type: 'PLAYER_LEFT', playerId: player.playerId } as ServerMessage);
                  const updatedGame = this.gameService.getGame(game.id);
                  if (updatedGame) {
                    this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
                  }
                  console.log(`Player ${user.username} disconnected from waiting game ${game.id}, removed from room`);
                }
              } else {
                // 游戏进行中,玩家断线但数据保留,支持重连
                console.log(`Player ${user.username} disconnected from active game ${game.id}, data preserved for reconnection`);
              }
            }
          }

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

      case 'CREATE_ROOM_WITH_CUSTOM_SCRIPT':
        await this.handleCreateRoomWithCustomScript(socket, message.script, send);
        break;

      case 'JOIN_ROOM':
        await this.handleJoinRoom(socket, message.roomCode, send, message.playerId);
        break;

      case 'LEAVE_ROOM':
        await this.handleLeaveRoom(socket, send);
        break;

      case 'GOD_CREATE_TEST_GAME':
        await this.handleCreateTestGame(socket, message.scriptId, send);
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

      case 'SHERIFF_SIGNUP':
        await this.handleSheriffSignup(socket, message.runForSheriff, send);
        break;

      case 'SHERIFF_WITHDRAW':
        await this.handleSheriffWithdraw(socket, send);
        break;

      case 'SHERIFF_VOTE':
        await this.handleSheriffVote(socket, message.candidateId, send);
        break;

      case 'EXILE_VOTE':
        await this.handleExileVote(socket, message.targetId, send);
        break;

      case 'EXILE_PK_VOTE':
        await this.handleExilePKVote(socket, message.targetId, send);
        break;

      case 'SHERIFF_TRANSFER':
        await this.handleSheriffTransfer(socket, message.targetId, send);
        break;

      case 'GOD_ASSIGN_SHERIFF':
        await this.handleGodAssignSheriff(socket, message.targetId, send);
        break;

      case 'GOD_SHERIFF_START_CAMPAIGN':
        await this.handleGodSheriffStartCampaign(socket, send);
        break;

      case 'GOD_SHERIFF_START_VOTING':
        await this.handleGodSheriffStartVoting(socket, send);
        break;

      case 'GOD_SHERIFF_TALLY_VOTES':
        await this.handleGodSheriffTallyVotes(socket, send);
        break;

      case 'GOD_RESOLVE_DEATH_TRIGGER':
        await this.handleGodResolveDeathTrigger(socket, message.triggerId, message.targetId, send);
        break;

      case 'WOLF_CHAT_SEND':
        await this.handleWolfChat(socket, message.content, send);
        break;

      case 'GOD_TOGGLE_AUTO_ADVANCE':
        await this.handleToggleAutoAdvance(socket, message.enabled, send);
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

  /**
   * 使用自定义剧本创建房间
   */
  private async handleCreateRoomWithCustomScript(socket: Socket, script: any, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    // 注册临时剧本
    const scriptId = this.scriptService.registerCustomScript(script);
    if (!scriptId) {
      send({ type: 'ERROR', message: '剧本配置无效' });
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
    console.log(`[Custom] God ${user.username} 创建了自定义剧本游戏: ${game.roomCode} (${script.playerCount}人)`);
  }

  /**
   * 创建测试游戏（带机器人玩家）
   */
  private async handleCreateTestGame(socket: Socket, scriptId: string, send: (msg: ServerMessage) => void) {
    const user = this.socketUsers.get(socket.id);
    if (!user || user.role !== 'god') {
      send({ type: 'ERROR', message: '需要上帝权限' });
      return;
    }

    const game = await this.gameService.createTestGame(user.userId, user.username, scriptId);
    if (!game) {
      send({ type: 'ERROR', message: '创建测试游戏失败' });
      return;
    }

    socket.join(game.id);
    send({ type: 'ROOM_CREATED', roomCode: game.roomCode, gameId: game.id });
    send({ type: 'GAME_STATE_UPDATE', game });
    console.log(`[Test] God ${user.username} 创建了测试游戏: ${game.roomCode}`);
  }

  private async handleJoinRoom(socket: Socket, roomCode: string, send: (msg: ServerMessage) => void, requestedPlayerId?: number) {
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
      // 检查玩家是否已经在游戏中(断线重连)
      const existingPlayer = game.players.find(p => p.userId === user.userId);

      if (existingPlayer) {
        // 断线重连:玩家已在游戏中,恢复连接
        socket.join(game.id);
        send({ type: 'ROOM_JOINED', game });
        console.log(`Player ${user.username} reconnected to game ${game.id}`);
      } else {
        // 新玩家加入
        const player = await this.gameService.addPlayer(game.id, user.userId, user.username, requestedPlayerId);
        if (!player) {
          send({ type: 'ERROR', message: requestedPlayerId ? `号位 ${requestedPlayerId} 已被占用或无效` : '加入房间失败' });
          return;
        }

        socket.join(game.id);

        // 获取更新后的游戏状态
        const updatedGame = this.gameService.getGame(game.id);
        if (!updatedGame) {
          send({ type: 'ERROR', message: '获取游戏状态失败' });
          return;
        }

        // 向加入的玩家发送完整的游戏状态
        send({ type: 'ROOM_JOINED', game: updatedGame });

        // 向所有客户端广播玩家加入消息和更新的游戏状态
        this.io.to(game.id).emit('message', { type: 'PLAYER_JOINED', player } as ServerMessage);
        this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
      }
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
          // 只在游戏还在等待状态时才真正删除玩家
          // 游戏开始后,玩家断线不会被删除,支持重连
          if (game.status === 'waiting') {
            await this.gameService.removePlayer(game.id, user.userId);
            this.io.to(game.id).emit('message', { type: 'PLAYER_LEFT', playerId: player.playerId } as ServerMessage);
            // 广播完整游戏状态，确保所有客户端同步
            const updatedGame = this.gameService.getGame(game.id);
            if (updatedGame) {
              this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
            }
          } else {
            console.log(`Player ${user.username} disconnected from game ${game.id}, but can reconnect`);
          }
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

    // 如果有机器人，执行第一个阶段的机器人行动
    if (game.hasBot) {
      await this.gameService.executeBotActionsForCurrentPhase(game.id);
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
      prompt: `${updatedGame.currentPhase}阶段`,
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

    let updatedGame = this.gameService.getGame(game.id);
    if (!updatedGame) return;

    // 如果进入警长竞选阶段且有机器人，执行机器人上警
    if (result.nextPhase === 'sheriffElection' && updatedGame.hasBot) {
      await this.gameService.executeBotSheriffSignup(game.id);
      updatedGame = this.gameService.getGame(game.id);
      if (!updatedGame) return;

      // 广播警长竞选状态
      if (updatedGame.sheriffElection) {
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_ELECTION_UPDATE',
          state: updatedGame.sheriffElection
        } as ServerMessage);
      }
    }

    // 如果进入投票阶段且有机器人，执行机器人放逐投票
    if (result.nextPhase === 'vote' && updatedGame.hasBot) {
      await this.gameService.executeBotExileVote(game.id);
      updatedGame = this.gameService.getGame(game.id);
      if (!updatedGame) return;

      // 广播放逐投票状态
      if (updatedGame.exileVote) {
        this.io.to(game.id).emit('message', {
          type: 'EXILE_VOTE_UPDATE',
          state: updatedGame.exileVote
        } as ServerMessage);
      }
    }

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

    // 验证 action 基本结构
    if (!action || typeof action.playerId !== 'number' || typeof action.actionType !== 'string') {
      send({ type: 'ERROR', message: '无效的操作数据' });
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

    // 验证 playerId 归属：确保操作者是该玩家本人（上帝可代替任意玩家操作）
    const player = game.players.find(p => p.userId === user.userId);
    if (user.role !== 'god') {
      if (!player) {
        send({ type: 'ERROR', message: '你不是该游戏的玩家' });
        return;
      }
      if (player.playerId !== action.playerId) {
        send({ type: 'ERROR', message: '不能代替其他玩家操作' });
        return;
      }
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

      // 自动推进检查
      await this.performAutoAdvanceIfReady(game.id);
    }
  }

  // ================= 自动阶段推进 =================

  /**
   * 检查并执行自动阶段推进，包括广播状态更新
   * 支持递归（bot行动后可能触发下一轮推进），加深度保护
   */
  private async performAutoAdvanceIfReady(gameId: string, depth: number = 0): Promise<void> {
    if (depth > 20) return;

    const autoResult = await this.gameService.checkAndAutoAdvance(gameId);
    if (!autoResult.advanced) return;

    const finalGame = this.gameService.getGame(gameId);
    if (!finalGame) return;

    // 广播自动推进通知（上帝端可用于显示 toast）
    this.io.to(gameId).emit('message', {
      type: 'AUTO_PHASE_ADVANCED',
      phase: autoResult.nextPhase,
      reason: autoResult.reason || '',
    } as ServerMessage);

    // 广播阶段变更和游戏状态
    this.io.to(gameId).emit('message', { type: 'GAME_STATE_UPDATE', game: finalGame } as ServerMessage);
    this.io.to(gameId).emit('message', {
      type: 'PHASE_CHANGED',
      phase: autoResult.nextPhase,
      prompt: autoResult.prompt || '',
    } as ServerMessage);

    if (autoResult.finished || finalGame.status === 'finished') {
      this.io.to(gameId).emit('message', {
        type: 'GAME_FINISHED',
        winner: finalGame.winner!,
      } as ServerMessage);
      return;
    }

    // 如果有 bot 且 bot 行动后可能满足新阶段的完成条件，递归检查
    if (finalGame.hasBot && finalGame.status === 'running') {
      await this.performAutoAdvanceIfReady(gameId, depth + 1);
    }
  }

  /**
   * 上帝切换自动推进开关
   */
  private async handleToggleAutoAdvance(
    socket: Socket,
    enabled: boolean,
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    game.autoAdvanceEnabled = enabled;
    this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game } as ServerMessage);
    send({ type: 'ACTION_RESULT', success: true, message: enabled ? '已开启自动推进' : '已关闭自动推进' } as any);
  }

  // ================= 狼人聊天处理 =================

  private async handleWolfChat(
    socket: Socket,
    content: string,
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

    // 验证：当前必须是狼人刀人阶段
    if (game.currentPhase !== 'wolf') {
      send({ type: 'ERROR', message: '当前不是狼人刀人阶段' });
      return;
    }

    // 验证：发送者必须是存活的狼人阵营
    const player = game.players.find(p => p.userId === user.userId);
    if (!player || !player.alive || player.camp !== 'wolf') {
      send({ type: 'ERROR', message: '只有存活的狼人才能发送消息' });
      return;
    }

    // 构建聊天消息
    const chatMessage = {
      playerId: player.playerId,
      playerName: player.username,
      content,
      timestamp: new Date().toISOString(),
    };

    // 存储到 nightActions.wolfChat
    if (!game.nightActions.wolfChat) {
      game.nightActions.wolfChat = [];
    }
    game.nightActions.wolfChat.push(chatMessage);

    // 广播给同房间所有存活狼人
    for (const wolfPlayer of game.players.filter(p => p.camp === 'wolf' && p.alive)) {
      const wolfSocket = this.userSockets.get(wolfPlayer.userId);
      if (wolfSocket) {
        wolfSocket.emit('message', {
          type: 'WOLF_CHAT_MESSAGE',
          message: chatMessage,
        } as ServerMessage);
      }
    }
  }

  // ================= 警长竞选处理 =================

  private async handleSheriffSignup(
    socket: Socket,
    runForSheriff: boolean,
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player) {
      send({ type: 'ERROR', message: '玩家不存在' });
      return;
    }

    const success = await this.gameService.sheriffSignup(game.id, player.playerId, runForSheriff);
    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
        if (updatedGame.sheriffElection) {
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_ELECTION_UPDATE',
            state: updatedGame.sheriffElection
          } as ServerMessage);
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: runForSheriff ? '上警成功' : '选择不上警' });
    } else {
      send({ type: 'ERROR', message: '上警失败' });
    }
  }

  private async handleSheriffWithdraw(
    socket: Socket,
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player) {
      send({ type: 'ERROR', message: '玩家不存在' });
      return;
    }

    const success = await this.gameService.sheriffWithdraw(game.id, player.playerId);
    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        this.io.to(game.id).emit('message', { type: 'GAME_STATE_UPDATE', game: updatedGame } as ServerMessage);
        if (updatedGame.sheriffElection) {
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_ELECTION_UPDATE',
            state: updatedGame.sheriffElection
          } as ServerMessage);
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: '退水成功' });
    } else {
      send({ type: 'ERROR', message: '退水失败' });
    }
  }

  private async handleSheriffVote(
    socket: Socket,
    candidateId: number | 'skip',
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player) {
      send({ type: 'ERROR', message: '玩家不存在' });
      return;
    }

    const success = await this.gameService.voteForSheriff(game.id, player.playerId, candidateId);
    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame && updatedGame.sheriffElection) {
        // 检查是否所有有投票权的人都已投票（活着的非候选人、非退水者）
        const eligibleVoters = updatedGame.players.filter(
          p => p.alive && !updatedGame.sheriffElection!.candidates.includes(p.playerId) && !updatedGame.sheriffElection!.withdrawn.includes(p.playerId)
        );
        const allVoted = eligibleVoters.every(
          p => updatedGame.sheriffElection!.votes[p.playerId] !== undefined
        );

        if (allVoted) {
          // 所有人投完，自动计票
          const result = await this.gameService.tallySheriffVotes(updatedGame.id);
          const finalGame = this.gameService.getGame(updatedGame.id);

          if (finalGame) {
            this.io.to(game.id).emit('message', {
              type: 'GAME_STATE_UPDATE',
              game: finalGame
            } as ServerMessage);

            if (finalGame.sheriffElection) {
              this.io.to(game.id).emit('message', {
                type: 'SHERIFF_ELECTION_UPDATE',
                state: finalGame.sheriffElection
              } as ServerMessage);

              // 广播投票结果给所有玩家（含投票明细和加权计票）
              this.io.to(game.id).emit('message', {
                type: 'SHERIFF_VOTE_RESULT',
                election: finalGame.sheriffElection,
                winnerId: result.winner,
                isTie: result.isTie,
              } as ServerMessage);
            }

            if (result.winner) {
              this.io.to(game.id).emit('message', {
                type: 'SHERIFF_BADGE_UPDATE',
                sheriffId: result.winner,
                state: 'normal',
                reason: `${result.winner}号当选警长`,
              } as ServerMessage);
            }
          }
        } else {
          // 还有人没投，仅广播投票进度更新
          this.io.to(game.id).emit('message', {
            type: 'GAME_STATE_UPDATE',
            game: updatedGame
          } as ServerMessage);

          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_ELECTION_UPDATE',
            state: updatedGame.sheriffElection
          } as ServerMessage);
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: '投票成功' });
    } else {
      send({ type: 'ERROR', message: '投票失败' });
    }
  }

  // ================= 放逐投票处理 =================

  private async handleExileVote(
    socket: Socket,
    targetId: number | 'skip',
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player) {
      send({ type: 'ERROR', message: '玩家不存在' });
      return;
    }

    const success = await this.gameService.voteForExile(game.id, player.playerId, targetId);
    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame && updatedGame.exileVote) {
        this.io.to(game.id).emit('message', {
          type: 'EXILE_VOTE_UPDATE',
          state: updatedGame.exileVote
        } as ServerMessage);
      }
      send({ type: 'ACTION_RESULT', success: true, message: '投票成功' });

      // 自动推进检查（所有人投完后自动进入结算）
      await this.performAutoAdvanceIfReady(game.id);
    } else {
      send({ type: 'ERROR', message: '投票失败' });
    }
  }

  private async handleExilePKVote(
    socket: Socket,
    targetId: number | 'skip',
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player) {
      send({ type: 'ERROR', message: '玩家不存在' });
      return;
    }

    const success = await this.gameService.voteForExilePK(game.id, player.playerId, targetId);
    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame && updatedGame.exileVote) {
        this.io.to(game.id).emit('message', {
          type: 'EXILE_VOTE_UPDATE',
          state: updatedGame.exileVote
        } as ServerMessage);
      }
      send({ type: 'ACTION_RESULT', success: true, message: 'PK投票成功' });

      // 自动推进检查
      await this.performAutoAdvanceIfReady(game.id);
    } else {
      send({ type: 'ERROR', message: 'PK投票失败' });
    }
  }

  // ================= 警徽传递处理 =================

  private async handleSheriffTransfer(
    socket: Socket,
    targetId: number | 'destroy',
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

    const player = game.players.find(p => p.userId === user.userId);
    if (!player || !game.pendingSheriffTransfer ||
        game.pendingSheriffTransfer.fromPlayerId !== player.playerId) {
      send({ type: 'ERROR', message: '你不是当前警长或无需传递警徽' });
      return;
    }

    let success: boolean;
    let reason: string;

    if (targetId === 'destroy') {
      success = await this.gameService.destroySheriffBadge(game.id);
      reason = '警徽已撕毁';
    } else {
      success = await this.gameService.transferSheriffBadge(game.id, targetId);
      reason = `警徽传递给${targetId}号`;
    }

    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        this.io.to(game.id).emit('message', {
          type: 'GAME_STATE_UPDATE',
          game: updatedGame
        } as ServerMessage);
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_BADGE_UPDATE',
          sheriffId: updatedGame.sheriffId,
          state: updatedGame.sheriffBadgeState || 'normal',
          reason,
        } as ServerMessage);
      }
      send({ type: 'ACTION_RESULT', success: true, message: reason });
    } else {
      send({ type: 'ERROR', message: '操作失败' });
    }
  }

  // ================= 上帝指定警长处理 =================

  private async handleGodAssignSheriff(
    socket: Socket,
    targetId: number | 'none',
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    // 验证是否需要上帝指定（包括：平票指定、警徽待分配、警长死亡待移交）
    const needAssign = game.sheriffBadgeState === 'pending_assign' ||
      game.sheriffBadgeState === 'pending_transfer' ||
      (game.sheriffElection && game.sheriffElection.phase === 'tie');

    if (!needAssign) {
      send({ type: 'ERROR', message: '当前不需要指定警长' });
      return;
    }

    // 如果是警长死亡移交，走 transferSheriffBadge 路径
    if (game.sheriffBadgeState === 'pending_transfer' && game.pendingSheriffTransfer) {
      let success: boolean;
      let reason: string;
      if (targetId === 'none') {
        success = await this.gameService.destroySheriffBadge(game.id);
        reason = '上帝选择不给警徽，警徽流失';
      } else {
        success = await this.gameService.transferSheriffBadge(game.id, targetId as number);
        reason = `警徽传递给${targetId}号`;
      }

      if (success) {
        const updatedGame = this.gameService.getGame(game.id);
        if (updatedGame) {
          this.io.to(game.id).emit('message', {
            type: 'GAME_STATE_UPDATE',
            game: updatedGame
          } as ServerMessage);
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_BADGE_UPDATE',
            sheriffId: updatedGame.sheriffId,
            state: updatedGame.sheriffBadgeState || 'normal',
            reason,
          } as ServerMessage);
        }
        send({ type: 'ACTION_RESULT', success: true, message: reason });
      } else {
        send({ type: 'ERROR', message: '指定失败' });
      }
      return;
    }

    const success = await this.gameService.godAssignSheriff(game.id, targetId);

    if (success) {
      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        let reason: string;
        if (targetId === 'none') {
          reason = '上帝选择不给警徽，警徽流失';
        } else {
          reason = `上帝指定${targetId}号获得警徽`;
        }

        this.io.to(game.id).emit('message', {
          type: 'GAME_STATE_UPDATE',
          game: updatedGame
        } as ServerMessage);
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_BADGE_UPDATE',
          sheriffId: updatedGame.sheriffId,
          state: updatedGame.sheriffBadgeState || 'normal',
          reason,
        } as ServerMessage);
        if (updatedGame.sheriffElection) {
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_ELECTION_UPDATE',
            state: updatedGame.sheriffElection
          } as ServerMessage);

          // 广播最终选举结果（上帝指定）
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_VOTE_RESULT',
            election: updatedGame.sheriffElection,
            winnerId: targetId === 'none' ? null : targetId,
            isTie: false,
          } as ServerMessage);
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: '指定成功' });
    } else {
      send({ type: 'ERROR', message: '指定失败' });
    }
  }

  // ================= 上帝处理死亡触发 =================

  private async handleGodResolveDeathTrigger(
    socket: Socket,
    triggerId: string,
    targetId: number | 'skip',
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    const result = await this.gameService.resolveDeathTrigger(game.id, triggerId, targetId);
    if (!result.success) {
      send({ type: 'ERROR', message: result.message });
      return;
    }

    const updatedGame = this.gameService.getGame(game.id);
    if (updatedGame) {
      this.io.to(game.id).emit('message', {
        type: 'GAME_STATE_UPDATE',
        game: updatedGame,
      } as ServerMessage);
    }

    send({ type: 'ACTION_RESULT', success: true, message: result.message });
  }

  // ================= 上帝控制警长竞选阶段 =================

  private async handleGodSheriffStartCampaign(
    socket: Socket,
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    const success = await this.gameService.startSheriffCampaign(game.id);
    const updatedGame = this.gameService.getGame(game.id);

    if (updatedGame) {
      this.io.to(game.id).emit('message', {
        type: 'GAME_STATE_UPDATE',
        game: updatedGame
      } as ServerMessage);

      if (updatedGame.sheriffElection) {
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_ELECTION_UPDATE',
          state: updatedGame.sheriffElection
        } as ServerMessage);
      }
    }

    if (success) {
      // 如果有机器人，执行机器人退水决策
      if (updatedGame?.hasBot) {
        await this.gameService.executeBotSheriffWithdraw(game.id);
        // 重新获取更新后的游戏状态并广播
        const gameAfterWithdraw = this.gameService.getGame(game.id);
        if (gameAfterWithdraw) {
          this.io.to(game.id).emit('message', {
            type: 'GAME_STATE_UPDATE',
            game: gameAfterWithdraw
          } as ServerMessage);
          if (gameAfterWithdraw.sheriffElection) {
            this.io.to(game.id).emit('message', {
              type: 'SHERIFF_ELECTION_UPDATE',
              state: gameAfterWithdraw.sheriffElection
            } as ServerMessage);
          }
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: '进入竞选发言阶段' });
    } else {
      // 可能是因为只有一人上警直接当选，或者没人上警
      if (updatedGame?.sheriffElectionDone) {
        send({ type: 'ACTION_RESULT', success: true, message: '警长竞选已完成' });
      } else {
        send({ type: 'ERROR', message: '进入发言阶段失败' });
      }
    }
  }

  private async handleGodSheriffStartVoting(
    socket: Socket,
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    const success = await this.gameService.startSheriffVoting(game.id);
    if (success) {
      // 如果有机器人，执行机器人警长投票
      if (game.hasBot) {
        await this.gameService.executeBotSheriffVote(game.id);
      }

      const updatedGame = this.gameService.getGame(game.id);
      if (updatedGame) {
        this.io.to(game.id).emit('message', {
          type: 'GAME_STATE_UPDATE',
          game: updatedGame
        } as ServerMessage);

        if (updatedGame.sheriffElection) {
          this.io.to(game.id).emit('message', {
            type: 'SHERIFF_ELECTION_UPDATE',
            state: updatedGame.sheriffElection
          } as ServerMessage);
        }
      }
      send({ type: 'ACTION_RESULT', success: true, message: '进入投票阶段' });
    } else {
      send({ type: 'ERROR', message: '进入投票阶段失败' });
    }
  }

  private async handleGodSheriffTallyVotes(
    socket: Socket,
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
    if (!game) {
      send({ type: 'ERROR', message: '游戏不存在' });
      return;
    }

    const result = await this.gameService.tallySheriffVotes(game.id);
    const updatedGame = this.gameService.getGame(game.id);

    if (updatedGame) {
      this.io.to(game.id).emit('message', {
        type: 'GAME_STATE_UPDATE',
        game: updatedGame
      } as ServerMessage);

      if (updatedGame.sheriffElection) {
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_ELECTION_UPDATE',
          state: updatedGame.sheriffElection
        } as ServerMessage);

        // 广播投票结果给所有玩家（含投票明细和加权计票）
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_VOTE_RESULT',
          election: updatedGame.sheriffElection,
          winnerId: result.winner,
          isTie: result.isTie,
        } as ServerMessage);
      }

      // 如果有人当选，广播警徽更新
      if (result.winner) {
        this.io.to(game.id).emit('message', {
          type: 'SHERIFF_BADGE_UPDATE',
          sheriffId: result.winner,
          state: 'normal',
          reason: `${result.winner}号当选警长`,
        } as ServerMessage);
      }
    }

    if (result.isTie) {
      send({ type: 'ACTION_RESULT', success: true, message: `平票！请指定警长：${result.tiedPlayers?.join('号、')}号` });
    } else if (result.winner) {
      send({ type: 'ACTION_RESULT', success: true, message: `${result.winner}号当选警长` });
    } else {
      send({ type: 'ACTION_RESULT', success: true, message: '无人当选警长' });
    }
  }
}
