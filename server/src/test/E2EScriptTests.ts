/**
 * 以剧本为粒度的完整测试套件
 *
 * 每个剧本包含：
 * 1. 剧本规则复述测试（验证核心机制）
 * 2. 容易忽视的边界情况测试
 * 3. 典型游戏场景测试
 */

import {
  E2ETestExecutor,
  E2ETestConfig,
  TestRound,
  ScenarioBuilder,
} from './E2ETestFramework.js';

// ==================== 摄梦人剧本测试套件 ====================

/**
 * 摄梦人剧本规则：
 * - 阵营：噩梦之影 + 3狼 vs 摄梦人 + 预言家 + 女巫 + 猎人 + 4民
 * - 核心机制：摄梦人连续两晚梦同一人会梦死
 * - 噩梦之影：恐惧一名玩家，使其当回合无法行动
 * - 容易忽视：恐惧持续整个回合（夜晚+白天），白天结算后清除
 */
export const dreamerScriptTests = {
  /**
   * 规则1：摄梦人连续两晚梦死机制
   */
  dreamerConsecutiveDreamKill: {
    config: {
      name: '【摄梦人】连续两晚梦死机制',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证摄梦人连续两晚梦同一人会导致目标梦死',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 第一晚梦10号
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 第二晚再梦10号
          { phase: 'wolf', playerId: 2, target: 11 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [9, 10, 11], // 10号应该梦死
      },
    ] as TestRound[],
  },

  /**
   * 规则2：摄梦人不连续梦不会梦死
   */
  dreamerNonConsecutiveDream: {
    config: {
      name: '【摄梦人】不连续梦不会梦死',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证摄梦人梦不同人或隔回合梦不会触发梦死',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 第一晚梦10号
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 11 }, // 第二晚梦11号（不同人）
          { phase: 'wolf', playerId: 2, target: 12 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [9, 12], // 只有12号死，10和11号都活着
      },
    ] as TestRound[],
  },

  /**
   * 规则3：噩梦之影恐惧机制
   */
  nightmareFearMechanism: {
    config: {
      name: '【摄梦人】噩梦恐惧持续整个回合',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证恐惧持续整个回合（夜晚+白天），白天结算后清除',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'fear', playerId: 1, target: 8 }, // 恐惧猎人
          { phase: 'dream', playerId: 5, target: 2 },
          { phase: 'wolf', playerId: 2, target: 8 }, // 刀猎人
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [8], // 猎人被刀死，但因恐惧无法开枪
      },
    ] as TestRound[],
  },

  /**
   * 边界情况1：摄梦人不能梦自己
   */
  dreamerDreamThemself: {
    config: {
      name: '【摄梦人】边界：摄梦人不能梦自己',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证摄梦人不能选择自己作为梦的目标',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 5, expected: { success: false, message: '自己' } }, // 梦自己应该失败
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },

  /**
   * 边界情况2：第二晚女巫救人 vs 摄梦人梦死
   */
  witchSaveThenDreamerKill: {
    config: {
      name: '【摄梦人】边界：女巫救人 vs 梦死',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证第二晚同时女巫救人和摄梦人梦死，哪个优先级更高',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 第一晚梦10号
          { phase: 'wolf', playerId: 2, target: 9 }, // 狼刀9号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } }, // 女巫不操作（保留解药）
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9], // 9号死
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 第二晚再梦10号（触发梦死）
          { phase: 'wolf', playerId: 2, target: 10 }, // 狼也刀10号
          { phase: 'witch', playerId: 7, target: 10, data: { actionType: 'save' } }, // 女巫救10号
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        // 关键问题：10号既被梦死，又被狼刀，还被女巫救
        // 预期：梦死是特殊死亡，不能被救，所以10号死
        expectedDeaths: [9, 10], // 10号被梦死（女巫救不了梦死）
      },
    ] as TestRound[],
  },

  /**
   * 边界情况3：噩梦之影不能恐惧自己
   */
  nightmareFearSelf: {
    config: {
      name: '【摄梦人】边界：噩梦之影不能恐惧自己',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证噩梦之影不能选择自己作为恐惧目标',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'fear', playerId: 1, target: 1, expected: { success: false, message: '自己' } }, // 恐惧自己应该失败
          { phase: 'dream', playerId: 5, target: 2 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },

  /**
   * 边界情况4：恐惧预言家后清除
   */
  fearClearAfterDay: {
    config: {
      name: '【摄梦人】边界：恐惧在白天结算后清除',
      scriptId: 'dreamer-nightmare',
      roleAssignments: ScenarioBuilder.dreamerScript(),
      scenario: '验证恐惧状态在白天结算后正确清除',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'fear', playerId: 1, target: 6 }, // 恐惧预言家
          { phase: 'dream', playerId: 5, target: 2 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2, expected: { success: false, message: '恐惧' } }, // 应该失败
        ],
        expectedDeaths: [9],
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'fear', playerId: 1, target: 7 }, // 恐惧女巫（换人）
          { phase: 'dream', playerId: 5, target: 3 },
          { phase: 'wolf', playerId: 2, target: 10 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' }, expected: { success: false } }, // 女巫被恐惧
          { phase: 'seer', playerId: 6, target: 3 }, // 预言家应该能正常查验（恐惧已清除）
        ],
        expectedDeaths: [9, 10],
      },
    ] as TestRound[],
  },
};

// ==================== 骑士狼美人剧本测试套件 ====================

/**
 * 骑士狼美人剧本规则：
 * - 阵营：狼美人 + 3狼 vs 骑士 + 预言家 + 女巫 + 守卫 + 4民
 * - 核心机制：守卫不能连续守护同一人
 * - 狼美人魅惑后形成连结，狼美人死则目标连结死
 * - 骑士白天可决斗（全局一次）
 */
export const knightBeautyScriptTests = {
  /**
   * 规则1：守卫不能连续守护同一人
   */
  guardConsecutiveProtection: {
    config: {
      name: '【骑士狼美人】守卫连续守护限制',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证守卫不能连续两晚守护同一人',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 6 }, // 第一晚守护6号
          { phase: 'wolf', playerId: 1, target: 6 }, // 狼刀6号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        expectedDeaths: [], // 6号被守护，没人死
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 6, expected: { success: false, message: '不能' } }, // 应该失败
          { phase: 'wolf', playerId: 1, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },

  /**
   * 规则2：守卫守护免疫狼刀
   */
  guardProtectionImmune: {
    config: {
      name: '【骑士狼美人】守卫守护免疫狼刀',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证守卫守护的玩家免疫狼刀',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 9 }, // 守护9号
          { phase: 'wolf', playerId: 1, target: 9 }, // 狼刀9号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        expectedDeaths: [], // 9号被守护，没人死
      },
    ] as TestRound[],
  },

  /**
   * 规则3：守卫守护 vs 女巫毒药
   */
  guardVsWitchPoison: {
    config: {
      name: '【骑士狼美人】守卫守护 vs 女巫毒药',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证守卫守护能否免疫女巫毒药（取决于规则）',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 9 }, // 守护9号
          { phase: 'wolf', playerId: 1, target: 10 }, // 狼刀10号
          { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'poison' } }, // 女巫毒9号
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        // 这里的预期取决于你的规则：守护能否免疫毒药？
        // 一般规则：守护只免疫狼刀，不免疫毒药
        expectedDeaths: [10, 9], // 10号被刀死，9号被毒死（守护无效）
      },
    ] as TestRound[],
  },

  /**
   * 边界情况1：守卫守护自己
   */
  guardProtectSelf: {
    config: {
      name: '【骑士狼美人】边界：守卫守护自己',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证守卫能否守护自己',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 8 }, // 守护自己
          { phase: 'wolf', playerId: 1, target: 8 }, // 狼刀守卫
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        // 如果规则允许自保，守卫应该活下来
        expectedDeaths: [], // 守卫自保成功
      },
    ] as TestRound[],
  },

  /**
   * 边界情况2：守卫守护死人
   */
  guardProtectDeadPlayer: {
    config: {
      name: '【骑士狼美人】边界：守卫守护死人',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证守卫不能守护已死玩家',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 6 },
          { phase: 'wolf', playerId: 1, target: 9 },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        expectedDeaths: [9],
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 9, expected: { success: false, message: '死亡' } }, // 应该失败
          { phase: 'wolf', playerId: 1, target: 10 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9, 10],
      },
    ] as TestRound[],
  },

  /**
   * 规则4：狼美人魅惑连结机制
   */
  wolfBeautyCharm: {
    config: {
      name: '【骑士狼美人】狼美人魅惑连结',
      scriptId: 'knight-beauty',
      roleAssignments: ScenarioBuilder.knightBeautyScript(),
      scenario: '验证狼美人魅惑后形成连结，狼美人死则目标连结死',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 6 },
          { phase: 'wolf', playerId: 1, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
          { phase: 'wolf_beauty', playerId: 4, target: 10 }, // 狼美人魅惑10号
        ],
        expectedDeaths: [9],
      },
      // TODO: 在白天投票放逐狼美人，验证10号是否连结死亡
    ] as TestRound[],
  },
};

// ==================== 守墓人石像鬼剧本测试套件 ====================

/**
 * 守墓人石像鬼剧本规则：
 * - 阵营：石像鬼（独狼）+ 3狼 vs 守墓人 + 预言家 + 女巫 + 猎人 + 4民
 * - 核心机制：石像鬼可查验具体角色（比预言家强）
 * - 石像鬼不参与狼刀，不与小狼见面
 * - 守墓人可验尸，得知死者身份
 */
export const gravekeeperGargoyleScriptTests = {
  /**
   * 规则1：石像鬼查验具体角色
   */
  gargoyleCheckSpecificRole: {
    config: {
      name: '【守墓人石像鬼】石像鬼查验具体角色',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证石像鬼能查验到具体角色名（而非只是阵营）',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 6 }, // 石像鬼查验6号（预言家）
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },

  /**
   * 规则2：石像鬼算狼阵营（4狼8好）
   */
  gargoyleIsWolfCamp: {
    config: {
      name: '【守墓人石像鬼】石像鬼算狼阵营',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证石像鬼计入狼阵营（4狼8好平衡）',
    },
    rounds: [] as TestRound[], // 这个在setupGame阶段就能验证
  },

  /**
   * 规则3：守墓人验尸获得阵营信息
   */
  gravekeeperAutopsy: {
    config: {
      name: '【守墓人石像鬼】守墓人验尸机制',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证守墓人能验尸得知死者阵营（好人/狼人，不知道具体角色）',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 6 },
          { phase: 'wolf', playerId: 2, target: 10 }, // 刀10号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        dayVotes: [
          // 所有存活玩家投票放逐9号平民
          { playerId: 1, target: 9 },
          { playerId: 2, target: 9 },
          { playerId: 3, target: 9 },
          { playerId: 4, target: 9 },
          { playerId: 5, target: 9 },
          { playerId: 6, target: 9 },
          { playerId: 7, target: 9 },
          { playerId: 8, target: 9 },
          { playerId: 11, target: 9 },
          { playerId: 12, target: 9 },
        ],
        expectedDeaths: [10, 9], // 10号夜晚被刀，9号白天被投票出局
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'gravekeeper', playerId: 5, target: 9 }, // 守墓人验尸9号（白天被投票出局）
          { phase: 'gargoyle', playerId: 1, target: 7 },
          { phase: 'wolf', playerId: 2, target: 11 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [10, 9, 11],
      },
    ] as TestRound[],
  },

  /**
   * 边界情况1：守墓人验尸狼人
   */
  gravekeeperAutopsyWolf: {
    config: {
      name: '【守墓人石像鬼】边界：守墓人验尸狼人',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证守墓人验尸狼人时返回狼人阵营（不知道具体角色）',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 6 },
          { phase: 'wolf', playerId: 2, target: 9 }, // 刀9号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        dayVotes: [
          // 所有存活玩家投票放逐2号狼人
          { playerId: 1, target: 2 },
          { playerId: 3, target: 2 },
          { playerId: 4, target: 2 },
          { playerId: 5, target: 2 },
          { playerId: 6, target: 2 },
          { playerId: 7, target: 2 },
          { playerId: 8, target: 2 },
          { playerId: 10, target: 2 },
          { playerId: 11, target: 2 },
          { playerId: 12, target: 2 },
        ],
        expectedDeaths: [9, 2], // 9号夜晚被刀，2号白天被投票出局
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'gravekeeper', playerId: 5, target: 2 }, // 守墓人验尸2号狼人（只知道是狼，不知道是普通狼）
          { phase: 'gargoyle', playerId: 1, target: 7 },
          { phase: 'wolf', playerId: 3, target: 10 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [9, 2, 10],
      },
    ] as TestRound[],
  },

  /**
   * 边界情况2：石像鬼不能查验自己
   */
  gargoyleCheckSelf: {
    config: {
      name: '【守墓人石像鬼】边界：石像鬼不能查验自己',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证石像鬼不能选择自己作为查验目标',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 1, expected: { success: false, message: '自己' } }, // 查验自己应该失败
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },

  /**
   * 边界情况3：守墓人验尸不存在的尸体
   */
  gravekeeperAutopsyNoBody: {
    config: {
      name: '【守墓人石像鬼】边界：守墓人验尸空气',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证守墓人在当前无投票出局玩家时不能验尸',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 6 },
          { phase: 'wolf', playerId: 2, target: 9 }, // 刀9号
          { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'save' } }, // 女巫救人
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        // 白天不投票（平安夜）
        expectedDeaths: [], // 没人死
      },
      {
        roundNumber: 2,
        nightActions: [
          { phase: 'gravekeeper', playerId: 5, target: 9, expected: { success: false } }, // 应该失败（9号还活着，且没有被投票出局的玩家）
          { phase: 'gargoyle', playerId: 1, target: 7 },
          { phase: 'wolf', playerId: 2, target: 10 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [10],
      },
    ] as TestRound[],
  },

  /**
   * 规则4：预言家查验石像鬼
   */
  seerCheckGargoyle: {
    config: {
      name: '【守墓人石像鬼】预言家查验石像鬼',
      scriptId: 'gravekeeper-gargoyle',
      roleAssignments: ScenarioBuilder.gravekeeperScript(),
      scenario: '验证预言家查验石像鬼时返回狼人身份',
    },
    rounds: [
      {
        roundNumber: 1,
        nightActions: [
          { phase: 'gargoyle', playerId: 1, target: 6 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 }, // 预言家查验石像鬼
        ],
        expectedDeaths: [9],
      },
    ] as TestRound[],
  },
};

// ==================== 导出所有测试 ====================

export const allScriptTests = {
  dreamer: dreamerScriptTests,
  knightBeauty: knightBeautyScriptTests,
  gravekeeperGargoyle: gravekeeperGargoyleScriptTests,
};
