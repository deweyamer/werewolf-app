/**
 * 自动化测试运行器
 *
 * 功能：
 * 1. 批量运行测试套件
 * 2. 生成测试报告
 * 3. 统计测试覆盖率
 * 4. 支持测试组合（但不做笛卡尔积）
 */

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

export class TestRunner {
  private results: TestSuiteResult[] = [];

  /**
   * 运行单个测试
   */
  async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      return {
        name,
        passed: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        name,
        passed: false,
        duration,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 运行测试套件
   */
  async runSuite(suiteName: string, tests: Array<{ name: string; fn: () => Promise<void> }>): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    for (const test of tests) {
      console.log(`\n运行测试: ${test.name}`);
      const result = await this.runTest(test.name, test.fn);
      results.push(result);

      if (result.passed) {
        console.log(`✅ 通过 (${result.duration}ms)`);
      } else {
        console.log(`❌ 失败 (${result.duration}ms)`);
        console.log(`   错误: ${result.error}`);
      }
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    const suiteResult: TestSuiteResult = {
      suiteName,
      totalTests: tests.length,
      passed,
      failed,
      duration,
      results,
    };

    this.results.push(suiteResult);
    return suiteResult;
  }

  /**
   * 生成测试报告
   */
  generateReport(): string {
    let report = '\n';
    report += '='.repeat(80) + '\n';
    report += '                         狼人杀 E2E 测试报告\n';
    report += '='.repeat(80) + '\n\n';

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    for (const suite of this.results) {
      report += `📦 ${suite.suiteName}\n`;
      report += `-`.repeat(80) + '\n';
      report += `   总测试数: ${suite.totalTests}\n`;
      report += `   ✅ 通过: ${suite.passed}\n`;
      report += `   ❌ 失败: ${suite.failed}\n`;
      report += `   ⏱️  耗时: ${suite.duration}ms\n`;
      report += `   通过率: ${((suite.passed / suite.totalTests) * 100).toFixed(1)}%\n\n`;

      if (suite.failed > 0) {
        report += `   失败的测试:\n`;
        for (const result of suite.results) {
          if (!result.passed) {
            report += `     ❌ ${result.name}\n`;
            report += `        错误: ${result.error}\n`;
          }
        }
        report += '\n';
      }

      totalTests += suite.totalTests;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.duration;
    }

    report += '='.repeat(80) + '\n';
    report += '                             总结\n';
    report += '='.repeat(80) + '\n';
    report += `总测试数: ${totalTests}\n`;
    report += `✅ 通过: ${totalPassed}\n`;
    report += `❌ 失败: ${totalFailed}\n`;
    report += `⏱️  总耗时: ${totalDuration}ms\n`;
    report += `通过率: ${((totalPassed / totalTests) * 100).toFixed(1)}%\n`;
    report += '='.repeat(80) + '\n';

    return report;
  }

  /**
   * 清空结果
   */
  clear(): void {
    this.results = [];
  }
}

// ==================== 测试策略矩阵 ====================

/**
 * 智能测试组合生成器
 *
 * 不做全笛卡尔积，而是基于以下策略：
 * 1. 成对测试（Pairwise Testing）：覆盖所有两两组合
 * 2. 边界值测试：测试极端情况
 * 3. 等价类划分：同一类的只测试代表性样本
 */
export class TestStrategyMatrix {
  /**
   * 生成成对测试用例
   *
   * 例如：测试3个角色技能的交互
   * 不需要测试 3! = 6 种全排列
   * 只需要测试所有成对组合即可
   */
  static generatePairwiseTests(factors: Record<string, string[]>): Array<Record<string, string>> {
    // 简化实现：只生成部分代表性组合
    const factorNames = Object.keys(factors);
    const combinations: Array<Record<string, string>> = [];

    // 基础组合：每个因素的第一个值
    const baseCase: Record<string, string> = {};
    for (const factor of factorNames) {
      baseCase[factor] = factors[factor][0];
    }
    combinations.push(baseCase);

    // 为每个因素的每个值生成一个测试用例
    for (const factor of factorNames) {
      for (let i = 1; i < factors[factor].length; i++) {
        const testCase = { ...baseCase };
        testCase[factor] = factors[factor][i];
        combinations.push(testCase);
      }
    }

    return combinations;
  }

  /**
   * 边界值测试用例生成
   *
   * 测试极端情况：
   * - 最小值
   * - 最大值
   * - 边界值
   */
  static generateBoundaryTests(): Array<{
    name: string;
    playerCount: number;
    wolfCount: number;
    godCount: number;
  }> {
    return [
      { name: '最少配置', playerCount: 6, wolfCount: 2, godCount: 2 },
      { name: '标准配置', playerCount: 12, wolfCount: 4, godCount: 4 },
      { name: '狼多配置', playerCount: 12, wolfCount: 5, godCount: 3 },
      { name: '神多配置', playerCount: 12, wolfCount: 3, godCount: 6 },
    ];
  }

  /**
   * 等价类测试用例生成
   *
   * 将相似的测试场景分组，每组只测试代表性样本
   */
  static generateEquivalenceTests(): Array<{
    category: string;
    representative: string;
    description: string;
  }> {
    return [
      {
        category: '查验类技能',
        representative: 'seer',
        description: '预言家查验（代表所有查验类技能）',
      },
      {
        category: '保护类技能',
        representative: 'guard',
        description: '守卫守护（代表所有保护类技能）',
      },
      {
        category: '死亡类技能',
        representative: 'witch_poison',
        description: '女巫毒药（代表所有造成死亡的技能）',
      },
      {
        category: '救治类技能',
        representative: 'witch_save',
        description: '女巫解药（代表所有救治类技能）',
      },
    ];
  }
}

// ==================== 测试优先级定义 ====================

export enum TestPriority {
  /** P0: 冒烟测试，每次都必须跑 */
  SMOKE = 'P0-SMOKE',
  /** P1: 核心功能，每日构建必须跑 */
  CRITICAL = 'P1-CRITICAL',
  /** P2: 重要功能，每周跑 */
  IMPORTANT = 'P2-IMPORTANT',
  /** P3: 边界情况，按需跑 */
  EDGE_CASE = 'P3-EDGE',
}

export interface PrioritizedTest {
  priority: TestPriority;
  name: string;
  fn: () => Promise<void>;
}

export class TestPriorityRunner {
  /**
   * 根据优先级过滤测试
   */
  static filterByPriority(tests: PrioritizedTest[], priority: TestPriority): PrioritizedTest[] {
    const priorityOrder = [
      TestPriority.SMOKE,
      TestPriority.CRITICAL,
      TestPriority.IMPORTANT,
      TestPriority.EDGE_CASE,
    ];

    const targetLevel = priorityOrder.indexOf(priority);
    return tests.filter(test => {
      const testLevel = priorityOrder.indexOf(test.priority);
      return testLevel <= targetLevel;
    });
  }

  /**
   * 运行指定优先级的测试
   */
  static async runPriority(tests: PrioritizedTest[], priority: TestPriority): Promise<TestSuiteResult> {
    const runner = new TestRunner();
    const filteredTests = this.filterByPriority(tests, priority);

    console.log(`\n运行 ${priority} 级别测试 (${filteredTests.length} 个)`);

    return await runner.runSuite(`${priority} Tests`, filteredTests);
  }
}
