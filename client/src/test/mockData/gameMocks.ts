/**
 * Mock data for testing
 * 提供各种游戏状态的模拟数据
 */

import { Game, GamePlayer } from '../../../../shared/src/types';

/**
 * 创建一个基础的测试游戏对象
 */
export function createMockGame(overrides?: Partial<Game>): Game {
  const defaultGame: Game = {
    id: 'test-game-123',
    roomCode: 'TEST01',
    hostUserId: 'host-user-1',
    hostUsername: 'TestHost',
    scriptId: 'dreamer-nightmare',
    scriptName: '摄梦人剧本',
    status: 'running',
    currentPhase: 'wolf',
    currentRound: 1,
    players: [],
    history: [],
    nightActions: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    startedAt: '2024-01-01T00:05:00.000Z',
  };

  return { ...defaultGame, ...overrides };
}

/**
 * 创建一个模拟玩家
 */
export function createMockPlayer(overrides?: Partial<GamePlayer>): GamePlayer {
  const defaultPlayer: GamePlayer = {
    userId: `user-${Math.random()}`,
    username: 'TestPlayer',
    playerId: 1,
    alive: true,
    role: 'villager',
    camp: 'good',
    isSheriff: false,
    abilities: {},
  };

  return { ...defaultPlayer, ...overrides };
}

/**
 * 创建完整的12人局游戏 (用于God Console测试)
 */
export function createMockFullGame(): Game {
  const players: GamePlayer[] = [
    createMockPlayer({ playerId: 1, role: 'nightmare', camp: 'wolf', username: '噩梦1号' }),
    createMockPlayer({ playerId: 2, role: 'wolf', camp: 'wolf', username: '狼人2号', alive: false, outReason: 'exile' }),
    createMockPlayer({ playerId: 3, role: 'wolf', camp: 'wolf', username: '狼人3号' }),
    createMockPlayer({ playerId: 4, role: 'wolf', camp: 'wolf', username: '狼人4号' }),
    createMockPlayer({ playerId: 5, role: 'gravekeeper', camp: 'good', username: '守墓5号' }),
    createMockPlayer({ playerId: 6, role: 'seer', camp: 'good', username: '预言家6号', isSheriff: true }),
    createMockPlayer({ playerId: 7, role: 'witch', camp: 'good', username: '女巫7号', abilities: { antidote: true, poison: true } }),
    createMockPlayer({ playerId: 8, role: 'hunter', camp: 'good', username: '猎人8号' }),
    createMockPlayer({ playerId: 9, role: 'villager', camp: 'good', username: '平民9号', alive: false, outReason: 'wolf_kill' }),
    createMockPlayer({ playerId: 10, role: 'villager', camp: 'good', username: '平民10号' }),
    createMockPlayer({ playerId: 11, role: 'villager', camp: 'good', username: '平民11号' }),
    createMockPlayer({ playerId: 12, role: 'villager', camp: 'good', username: '平民12号' }),
  ];

  return createMockGame({
    players,
    currentRound: 2,
    currentPhase: 'gravekeeper',
    nightActions: {
      wolfSubmitted: true,
      wolfKill: 10,
      wolfVotes: { 1: 10, 3: 10, 4: 10 },
      gravekeeperSubmitted: false,
    },
    history: [
      {
        id: 'log-1',
        round: 1,
        phase: 'wolf',
        action: 'wolf_kill',
        actorPlayerId: 2,
        target: 9,
        result: '狼人刀了9号',
        timestamp: '2024-01-01T00:10:00.000Z',
      },
      {
        id: 'log-2',
        round: 1,
        phase: 'daySettle',
        action: 'exile',
        actorPlayerId: 0,
        target: 2,
        result: '2号被投票放逐',
        timestamp: '2024-01-01T00:20:00.000Z',
      },
    ],
  });
}

/**
 * 创建用于测试守墓人规则的游戏状态
 * - 2号被投票放逐 (可验尸)
 * - 9号被狼刀 (不可验尸)
 */
export function createGravekeeperTestGame(): Game {
  const players: GamePlayer[] = [
    createMockPlayer({ playerId: 1, role: 'wolf', camp: 'wolf' }),
    createMockPlayer({ playerId: 2, role: 'wolf', camp: 'wolf', alive: false, outReason: 'exile' }),
    createMockPlayer({ playerId: 5, role: 'gravekeeper', camp: 'good' }),
    createMockPlayer({ playerId: 9, role: 'villager', camp: 'good', alive: false, outReason: 'wolf_kill' }),
    createMockPlayer({ playerId: 10, role: 'villager', camp: 'good' }),
  ];

  return createMockGame({
    players,
    currentPhase: 'gravekeeper',
    nightActions: {
      gravekeeperSubmitted: false,
    },
  });
}

/**
 * 创建用于测试投票机制的游戏状态
 */
export function createVotingTestGame(): Game {
  const players: GamePlayer[] = Array.from({ length: 12 }, (_, i) =>
    createMockPlayer({
      playerId: i + 1,
      username: `玩家${i + 1}号`,
      role: i < 4 ? 'wolf' : 'villager',
      camp: i < 4 ? 'wolf' : 'good',
    })
  );

  return createMockGame({
    players,
    currentPhase: 'vote',
    exileVote: {
      phase: 'voting',
      votes: {},
    },
  });
}

/**
 * 创建已结束的游戏 (好人胜利)
 */
export function createFinishedGameGoodWin(): Game {
  const players: GamePlayer[] = [
    createMockPlayer({ playerId: 1, role: 'wolf', camp: 'wolf', alive: false, outReason: 'exile' }),
    createMockPlayer({ playerId: 2, role: 'wolf', camp: 'wolf', alive: false, outReason: 'hunter_shoot' }),
    createMockPlayer({ playerId: 3, role: 'seer', camp: 'good', alive: true }),
    createMockPlayer({ playerId: 4, role: 'witch', camp: 'good', alive: true }),
    createMockPlayer({ playerId: 5, role: 'villager', camp: 'good', alive: false, outReason: 'wolf_kill' }),
  ];

  return createMockGame({
    players,
    status: 'finished',
    currentPhase: 'finished',
    winner: 'good',
    finishedAt: '2024-01-01T01:00:00.000Z',
  });
}
