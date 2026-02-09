/**
 * E2E 冒烟测试
 *
 * 测试策略：
 * - 只测试关键路径，不做笛卡尔积
 * - 每个剧本一个冒烟测试，验证基本流程
 * - 快速失败，发现核心问题
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { E2ETestExecutor, TestScenarios } from '../../helpers/E2ETestFramework.js';

describe('E2E 冒烟测试 - 关键路径验证', () => {
  let executor: E2ETestExecutor;

  beforeEach(async () => {
    executor = new E2ETestExecutor();
    await executor.init();
  });

  it('应该能完成标准游戏流程（2个回合）', async () => {
    const { config, rounds } = TestScenarios.smokeTest();

    console.log(`\n=== ${config.name} ===`);
    console.log(`剧本: ${config.scriptId}`);
    console.log(`场景: ${config.scenario}\n`);

    // 初始化游戏
    const game = await executor.setupGame(config);
    expect(game.status).toBe('running');
    expect(game.currentRound).toBe(1);

    // 执行测试回合
    for (const round of rounds) {
      await executor.executeRound(round);
    }

    console.log('\n✅ 冒烟测试通过\n');
  });

  it('守卫不能连续守护同一人', async () => {
    const { config, rounds } = TestScenarios.guardConsecutiveTest();

    console.log(`\n=== ${config.name} ===`);
    console.log(`场景: ${config.scenario}\n`);

    const game = await executor.setupGame(config);
    expect(game.status).toBe('running');

    for (const round of rounds) {
      await executor.executeRound(round);
    }

    console.log('\n✅ 守卫规则验证通过\n');
  });
});
