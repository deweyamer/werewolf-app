import { v4 as uuidv4 } from 'uuid';
import { Game, GamePlayer } from '../../../../shared/src/types.js';
import { SkillEffect, SkillEffectType, SkillPriority, SkillTiming } from '../../game/skill/SkillTypes.js';

export function createMockPlayer(
  playerId: number,
  role: string,
  camp: 'wolf' | 'good',
  overrides?: Partial<GamePlayer>
): GamePlayer {
  return {
    userId: `user-${playerId}`,
    username: `Player${playerId}`,
    playerId,
    role,
    camp,
    alive: true,
    isSheriff: false,
    abilities: {},
    ...overrides,
  };
}

export function createMockPlayers(
  roleMap: Record<number, { role: string; camp: 'wolf' | 'good' }>
): GamePlayer[] {
  return Object.entries(roleMap).map(([id, { role, camp }]) =>
    createMockPlayer(Number(id), role, camp)
  );
}

export function createMockGame(overrides?: Partial<Game>): Game {
  return {
    id: uuidv4(),
    roomCode: 'TEST01',
    scriptId: 'test',
    scriptName: 'Test',
    hostId: 'host-1',
    hostUsername: 'Host',
    players: [],
    status: 'running',
    currentRound: 1,
    currentPhase: 'wolf',
    currentPhaseType: 'night',
    history: [],
    sheriffId: 0,
    sheriffElectionDone: false,
    nightActions: {} as any,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createSkillEffect(
  type: SkillEffectType,
  priority: SkillPriority,
  actorId: number,
  targetId: number,
  timing: SkillTiming = SkillTiming.NIGHT_ACTION
): SkillEffect {
  return {
    id: uuidv4(),
    type,
    priority,
    actorId,
    targetId,
    timing,
    executed: false,
    blocked: false,
  };
}

export function createStandard12Players(): GamePlayer[] {
  return [
    createMockPlayer(1, 'wolf', 'wolf'),
    createMockPlayer(2, 'wolf', 'wolf'),
    createMockPlayer(3, 'wolf', 'wolf'),
    createMockPlayer(4, 'wolf', 'wolf'),
    createMockPlayer(5, 'seer', 'good'),
    createMockPlayer(6, 'witch', 'good'),
    createMockPlayer(7, 'hunter', 'good'),
    createMockPlayer(8, 'guard', 'good'),
    createMockPlayer(9, 'villager', 'good'),
    createMockPlayer(10, 'villager', 'good'),
    createMockPlayer(11, 'villager', 'good'),
    createMockPlayer(12, 'villager', 'good'),
  ];
}
