/**
 * 游戏统计工具函数
 * 从Game对象计算各种统计数据
 */

import { Game, GamePlayer, ActionLog } from '../../../shared/src/types';
import { getRoleName, translateDeathReason } from './phaseLabels';

/**
 * 游戏概览统计
 */
export interface GameOverviewStats {
  // 基础信息
  gameId: string;
  roomCode: string;
  scriptName: string;
  currentRound: number;
  currentPhase: string;
  status: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: string;

  // 阵营统计
  totalPlayers: number;
  aliveWolves: number;
  aliveGoods: number;
  deadWolves: number;
  deadGoods: number;

  // 胜利条件
  winner?: 'wolf' | 'good';
}

/**
 * 计算游戏概览统计
 */
export function calculateGameOverview(game: Game): GameOverviewStats {
  const alivePlayers = game.players.filter(p => p.alive);
  const aliveWolves = alivePlayers.filter(p => p.camp === 'wolf').length;
  const aliveGoods = alivePlayers.filter(p => p.camp === 'good').length;

  const deadPlayers = game.players.filter(p => !p.alive);
  const deadWolves = deadPlayers.filter(p => p.camp === 'wolf').length;
  const deadGoods = deadPlayers.filter(p => p.camp === 'good').length;

  let duration = undefined;
  if (game.startedAt && game.finishedAt) {
    const start = new Date(game.startedAt).getTime();
    const end = new Date(game.finishedAt).getTime();
    const minutes = Math.floor((end - start) / 60000);
    duration = `${minutes}分钟`;
  }

  return {
    gameId: game.id,
    roomCode: game.roomCode,
    scriptName: game.scriptName,
    currentRound: game.currentRound,
    currentPhase: game.currentPhase,
    status: game.status,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    duration,
    totalPlayers: game.players.length,
    aliveWolves,
    aliveGoods,
    deadWolves,
    deadGoods,
    winner: game.winner,
  };
}

/**
 * 玩家详细统计
 */
export interface PlayerStats {
  playerId: number;
  username: string;
  role: string;
  roleName: string;
  camp: 'wolf' | 'good';
  alive: boolean;

  // 死亡信息
  outReason?: string;
  outReasonText?: string;
  deathRound?: number;
  deathPhase?: string;

  // 特殊状态
  isSheriff: boolean;

  // 技能使用次数
  actionCount: number;
}

/**
 * 计算玩家统计
 */
export function calculatePlayerStats(game: Game): PlayerStats[] {
  return game.players.map(player => {
    // 查找死亡信息
    const deathLog = game.history.find(log =>
      log.result.includes(`${player.playerId}号`) &&
      (log.result.includes('死亡') || log.result.includes('出局'))
    );

    // 统计技能使用次数
    const actionCount = game.history.filter(
      log => log.actorPlayerId === player.playerId
    ).length;

    return {
      playerId: player.playerId,
      username: player.username,
      role: player.role || '未分配',
      roleName: player.role ? getRoleName(player.role) : '未分配',
      camp: player.camp!,
      alive: player.alive,
      outReason: player.outReason,
      outReasonText: translateDeathReason(player.outReason),
      deathRound: deathLog?.round,
      deathPhase: deathLog?.phase,
      isSheriff: player.isSheriff,
      actionCount,
    };
  });
}

/**
 * 技能使用记录
 */
export interface SkillUsage {
  round: number;
  phase: string;
  action: string;
  target?: number;
  result: string;
  timestamp: string;
}

/**
 * 获取玩家的技能使用历史
 */
export function getPlayerSkillUsages(game: Game, playerId: number): SkillUsage[] {
  return game.history
    .filter(log => log.actorPlayerId === playerId)
    .map(log => ({
      round: log.round,
      phase: log.phase,
      action: log.action,
      target: log.target,
      result: log.result,
      timestamp: log.timestamp,
    }));
}

/**
 * 夜晚操作摘要
 */
export interface NightActionsSummary {
  fear?: { actorId: number; targetId?: number; submitted: boolean };
  dream?: { actorId: number; targetId?: number; submitted: boolean };
  gargoyle?: { actorId: number; targetId?: number; submitted: boolean };
  guard?: { actorId: number; targetId?: number; submitted: boolean };
  wolf?: { targetId?: number; submitted: boolean; voters?: number[] };
  wolfBeauty?: { actorId: number; targetId?: number; submitted: boolean };
  witch?: {
    actorId: number;
    victimId?: number;
    action?: 'save' | 'poison' | 'none';
    targetId?: number;
    submitted: boolean;
  };
  seer?: {
    actorId: number;
    targetId?: number;
    result?: 'wolf' | 'good';
    submitted: boolean;
  };
  gravekeeper?: { actorId: number; targetId?: number; submitted: boolean };
}

/**
 * 从nightActions提取操作摘要
 */
export function extractNightActionsSummary(game: Game): NightActionsSummary {
  const na = game.nightActions;
  const summary: NightActionsSummary = {};

  // 恐惧
  if (na.fearSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'nightmare');
    summary.fear = {
      actorId: actor?.playerId || 0,
      targetId: na.fear,
      submitted: na.fearSubmitted,
    };
  }

  // 摄梦
  if (na.dreamSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'dreamer');
    summary.dream = {
      actorId: actor?.playerId || 0,
      targetId: na.dream,
      submitted: na.dreamSubmitted,
    };
  }

  // 石像鬼
  if (na.gargoyleSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'gargoyle');
    summary.gargoyle = {
      actorId: actor?.playerId || 0,
      targetId: na.gargoyleTarget,
      submitted: na.gargoyleSubmitted,
    };
  }

  // 守卫
  if (na.guardSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'guard');
    summary.guard = {
      actorId: actor?.playerId || 0,
      targetId: na.guardTarget,
      submitted: na.guardSubmitted,
    };
  }

  // 狼人
  if (na.wolfSubmitted !== undefined) {
    summary.wolf = {
      targetId: na.wolfKill,
      submitted: na.wolfSubmitted,
      voters: na.wolfVotes ? Object.keys(na.wolfVotes).map(Number) : [],
    };
  }

  // 狼美人
  if (na.wolfBeautySubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'wolf_beauty');
    summary.wolfBeauty = {
      actorId: actor?.playerId || 0,
      targetId: na.wolfBeautyTarget,
      submitted: na.wolfBeautySubmitted,
    };
  }

  // 女巫
  if (na.witchSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'witch');
    summary.witch = {
      actorId: actor?.playerId || 0,
      victimId: na.witchKnowsVictim || undefined,
      action: na.witchAction,
      targetId: na.witchTarget,
      submitted: na.witchSubmitted,
    };
  }

  // 预言家
  if (na.seerSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'seer');
    summary.seer = {
      actorId: actor?.playerId || 0,
      targetId: na.seerCheck,
      result: na.seerResult,
      submitted: na.seerSubmitted,
    };
  }

  // 守墓人
  if (na.gravekeeperSubmitted !== undefined) {
    const actor = game.players.find(p => p.role === 'gravekeeper');
    summary.gravekeeper = {
      actorId: actor?.playerId || 0,
      targetId: na.gravekeeperTarget,
      submitted: na.gravekeeperSubmitted,
    };
  }

  return summary;
}

/**
 * 获取角色状态文本
 */
export function getRoleStatusText(player: GamePlayer): string {
  if (!player.alive) {
    return '已出局';
  }

  const status: string[] = [];

  // 警长
  if (player.isSheriff) {
    status.push('警长');
  }

  // 技能状态（女巫）
  if (player.role === 'witch') {
    if (player.abilities.antidote) status.push('有解药');
    if (player.abilities.poison) status.push('有毒药');
  }

  // 守卫守护记录
  if (player.role === 'guard') {
    const guardHistory: number[] = player.abilities.guardHistory || [];
    if (guardHistory.length > 0) {
      const last = guardHistory[guardHistory.length - 1];
      status.push(`上晚守护${last === 0 ? '空守' : last + '号'}`);
    }
  }

  // 摄梦人
  if (player.role === 'dreamer' && player.abilities.lastDreamTarget) {
    status.push(`上晚梦游${player.abilities.lastDreamTarget}号`);
  }

  return status.length > 0 ? status.join(' | ') : '正常';
}
