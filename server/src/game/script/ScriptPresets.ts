import { ScriptV2, PlayerCountPreset } from './ScriptTypes.js';

/**
 * 预设剧本库
 * 提供多种人数配置的剧本
 */
export class ScriptPresets {
  /**
   * 获取所有预设剧本
   */
  static getAllPresets(): ScriptV2[] {
    return [
      ScriptPresets.STANDARD_TWELVE_PLAYER_SCRIPT, // 标准12人测试剧本放在最前面
      ScriptPresets.NINE_PLAYER_SCRIPT,
      ScriptPresets.DREAMER_SCRIPT,
      ScriptPresets.KNIGHT_BEAUTY_SCRIPT,
      ScriptPresets.GRAVEKEEPER_GARGOYLE_SCRIPT,
      ScriptPresets.FIFTEEN_PLAYER_SCRIPT,
      ScriptPresets.EIGHTEEN_PLAYER_SCRIPT,
    ];
  }

  /**
   * 获取人数预设配置
   */
  static getPlayerCountPresets(): PlayerCountPreset[] {
    return [
      {
        playerCount: 9,
        label: '9人标准局',
        wolves: 3,
        gods: 3,
        villagers: 3,
        description: '经典三狼局，策略丰富',
        recommendedRoles: [
          { roleId: 'wolf', count: 2, required: true },
          { roleId: 'wolf_beauty', count: 1, required: false },
          { roleId: 'seer', count: 1, required: false },
          { roleId: 'witch', count: 1, required: false },
          { roleId: 'hunter', count: 1, required: false },
          { roleId: 'villager', count: 3, required: true },
        ],
      },
      {
        playerCount: 12,
        label: '12人经典局',
        wolves: 4,
        gods: 4,
        villagers: 4,
        description: '最经典的狼人杀配置',
        recommendedRoles: [
          { roleId: 'wolf', count: 3, required: true },
          { roleId: 'nightmare', count: 1, required: false },
          { roleId: 'seer', count: 1, required: false },
          { roleId: 'witch', count: 1, required: false },
          { roleId: 'hunter', count: 1, required: false },
          { roleId: 'dreamer', count: 1, required: false },
          { roleId: 'villager', count: 4, required: true },
        ],
      },
      {
        playerCount: 15,
        label: '15人大型局',
        wolves: 5,
        gods: 5,
        villagers: 5,
        description: '大型局，角色更丰富',
        recommendedRoles: [
          { roleId: 'wolf', count: 3, required: true },
          { roleId: 'nightmare', count: 1, required: false },
          { roleId: 'wolf_beauty', count: 1, required: false },
          { roleId: 'seer', count: 1, required: false },
          { roleId: 'witch', count: 1, required: false },
          { roleId: 'hunter', count: 1, required: false },
          { roleId: 'guard', count: 1, required: false },
          { roleId: 'knight', count: 1, required: false },
          { roleId: 'villager', count: 5, required: true },
        ],
      },
      {
        playerCount: 18,
        label: '18人豪华局',
        wolves: 6,
        gods: 6,
        villagers: 6,
        description: '超大型局，需要经验玩家',
        recommendedRoles: [
          { roleId: 'wolf', count: 3, required: true },
          { roleId: 'nightmare', count: 1, required: false },
          { roleId: 'wolf_beauty', count: 1, required: false },
          { roleId: 'white_wolf', count: 1, required: false },
          { roleId: 'seer', count: 1, required: false },
          { roleId: 'witch', count: 1, required: false },
          { roleId: 'hunter', count: 1, required: false },
          { roleId: 'guard', count: 1, required: false },
          { roleId: 'dreamer', count: 1, required: false },
          { roleId: 'knight', count: 1, required: false },
          { roleId: 'villager', count: 6, required: true },
        ],
      },
    ];
  }

  /**
   * 标准12人剧本（预女猎守4狼4民）
   * 用于一键测试的标准配置
   */
  static readonly STANDARD_TWELVE_PLAYER_SCRIPT: ScriptV2 = {
    id: 'standard-twelve-player',
    name: '12人标准剧本（预女猎守）',
    description: '经典狼人杀配置：预言家、女巫、猎人、守卫 + 4狼人 + 4平民',
    playerCount: 12,

    roleComposition: {
      wolf: 4,         // 4个普通狼人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      guard: 1,        // 守卫
      villager: 4,     // 4个平民
    },

    ruleVariants: {
      skillInteractions: {
        guardCanProtectSame: false, // 守卫不能连续守护同一人
      },
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'medium',
    tags: ['标准', '12人', '经典', '测试'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（4人）**：4个普通狼人
- **好人阵营（8人）**：预言家、女巫、猎人、守卫、4个平民

### 角色技能
- **预言家**：每晚可以查验一名玩家的阵营（狼人/好人）
- **女巫**：有解药和毒药各一瓶，可以救人或毒人
- **猎人**：死亡时可以开枪带走一名玩家
- **守卫**：每晚可以守护一人，不能连续守护同一人

### 胜利条件
- **狼人胜利**：存活狼人数量 >= 存活好人数量
- **好人胜利**：放逐所有狼人

### 游戏流程
1. 第一夜：守卫守护 → 狼人杀人 → 女巫救/毒 → 预言家查验
2. 夜间结算后：警长竞选（仅第一轮）
3. 白天：讨论 → 投票放逐
4. 循环直到一方获胜
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 6人新手剧本
   */
  static readonly SIX_PLAYER_SCRIPT: ScriptV2 = {
    id: 'six-player-beginner',
    name: '6人新手剧本',
    description: '适合新手的入门配置，快速体验狼人杀核心玩法',
    playerCount: 6,

    roleComposition: {
      wolf: 2,         // 普通狼人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      villager: 2,     // 平民
    },

    ruleVariants: {
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'easy',
    tags: ['新手', '快速局', '6人'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（2人）**：2个普通狼人
- **好人阵营（4人）**：预言家、女巫、2个平民

### 胜利条件
- **狼人胜利**：屠杀所有好人
- **好人胜利**：放逐所有狼人
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 9人标准剧本
   */
  static readonly NINE_PLAYER_SCRIPT: ScriptV2 = {
    id: 'nine-player-standard',
    name: '9人标准剧本',
    description: '经典三狼配置，策略丰富',
    playerCount: 9,

    roleComposition: {
      wolf: 2,         // 普通狼人
      wolf_beauty: 1,  // 狼美人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      villager: 3,     // 平民
    },

    ruleVariants: {
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'medium',
    tags: ['标准', '9人', '狼美人'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（3人）**：狼美人 + 2个普通狼人
- **好人阵营（6人）**：预言家、女巫、猎人、3个平民

### 特殊规则
- 狼美人可以魅惑一名玩家，若狼美人死亡则目标连结死亡

### 胜利条件
- **狼人胜利**：屠杀所有好人
- **好人胜利**：放逐所有狼人
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 15人大型剧本
   */
  static readonly FIFTEEN_PLAYER_SCRIPT: ScriptV2 = {
    id: 'fifteen-player-advanced',
    name: '15人大型剧本',
    description: '大型局配置，角色丰富，策略多样',
    playerCount: 15,

    roleComposition: {
      wolf: 3,         // 普通狼人
      nightmare: 1,    // 噩梦之影
      wolf_beauty: 1,  // 狼美人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      guard: 1,        // 守卫
      knight: 1,       // 骑士
      villager: 5,     // 平民
    },

    ruleVariants: {
      skillInteractions: {
        guardCanProtectSame: false,
        dreamerKillNights: 2,
      },
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'hard',
    tags: ['大型局', '15人', '高阶'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（5人）**：噩梦之影、狼美人、3个普通狼人
- **好人阵营（10人）**：预言家、女巫、猎人、守卫、骑士、5个平民

### 特殊规则
- 噩梦之影首晚可以恐惧一名玩家
- 狼美人可以魅惑造成连结死亡
- 守卫每晚守护一人，不可连续守护同一人
- 骑士可以发起决斗

### 胜利条件
- **狼人胜利**：屠杀所有好人或屠杀所有神职
- **好人胜利**：放逐所有狼人
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 18人豪华剧本
   */
  static readonly EIGHTEEN_PLAYER_SCRIPT: ScriptV2 = {
    id: 'eighteen-player-premium',
    name: '18人豪华剧本',
    description: '超大型局，全角色体验，适合经验玩家',
    playerCount: 18,

    roleComposition: {
      wolf: 3,         // 普通狼人
      nightmare: 1,    // 噩梦之影
      wolf_beauty: 1,  // 狼美人
      white_wolf: 1,   // 白狼王
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      guard: 1,        // 守卫
      dreamer: 1,      // 摄梦人
      knight: 1,       // 骑士
      villager: 6,     // 平民
    },

    ruleVariants: {
      skillInteractions: {
        guardCanProtectSame: false,
        dreamerKillNights: 2,
      },
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'hard',
    tags: ['豪华局', '18人', '全角色'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（6人）**：噩梦之影、狼美人、白狼王、3个普通狼人
- **好人阵营（12人）**：预言家、女巫、猎人、守卫、摄梦人、骑士、6个平民

### 特殊规则
- 噩梦之影首晚可以恐惧一名玩家
- 狼美人可以魅惑造成连结死亡
- 白狼王是特殊狼人角色
- 摄梦人连续两晚梦到同一人会导致目标梦死
- 守卫每晚守护一人，不可连续守护同一人
- 骑士可以发起决斗

### 胜利条件
- **狼人胜利**：屠杀所有好人或屠杀所有神职
- **好人胜利**：放逐所有狼人
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 根据ID获取预设剧本
   */
  static getById(scriptId: string): ScriptV2 | undefined {
    return ScriptPresets.getAllPresets().find(s => s.id === scriptId);
  }

  /**
   * 摄梦人剧本
   * 配置：摄梦人、预言家、女巫、猎人、噩梦之影、3个普通狼人、4民
   */
  static readonly DREAMER_SCRIPT: ScriptV2 = {
    id: 'dreamer-nightmare',
    name: '摄梦人剧本',
    description: '经典摄梦人配置，噩梦之影与摄梦人形成恐惧与梦境的对抗',
    playerCount: 12,

    roleComposition: {
      nightmare: 1,    // 噩梦之影
      wolf: 3,         // 普通狼人
      dreamer: 1,      // 摄梦人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      villager: 4,     // 平民
    },

    ruleVariants: {
      skillInteractions: {
        dreamerKillNights: 2, // 摄梦人连续两晚梦死
      },
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'medium',
    tags: ['摄梦人', '噩梦之影', '新手友好', '信息对抗'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（4人）**：噩梦之影 + 3个普通狼人
- **好人阵营（8人）**：摄梦人、预言家、女巫、猎人、4个平民

### 特殊规则
- 摄梦人连续两晚梦到同一人会导致目标梦死
- 噩梦之影首晚可以恐惧一名玩家，使其无法行动
- 预言家可以查验身份，女巫有解药和毒药各一瓶
- 猎人死亡时可以开枪带走一人

### 胜利条件
- **狼人胜利**：屠杀所有好人或屠杀所有神职
- **好人胜利**：放逐所有狼人

### 技能优先级
1. 噩梦之影恐惧（首晚）
2. 守护/摄梦
3. 狼刀
4. 女巫解救/毒杀
5. 预言家查验
6. 结算死亡
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 骑士狼美人剧本
   * 配置：骑士、预言家、女巫、守卫、狼美人、3个普通狼人、4民
   */
  static readonly KNIGHT_BEAUTY_SCRIPT: ScriptV2 = {
    id: 'knight-beauty',
    name: '骑士狼美人剧本',
    description: '骑士决斗与狼美人魅惑的刺激对抗，强调操作与判断',
    playerCount: 12,

    roleComposition: {
      wolf: 3,         // 普通狼人
      wolf_beauty: 1,  // 狼美人
      knight: 1,       // 骑士
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      guard: 1,        // 守卫
      villager: 4,     // 平民
    },

    ruleVariants: {
      skillInteractions: {
        guardCanProtectSame: false, // 守卫不能连续守护同一人
      },
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'hard',
    tags: ['骑士', '狼美人', '高阶局', '连结死亡'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（4人）**：狼美人 + 3个普通狼人
- **好人阵营（8人）**：骑士、预言家、女巫、守卫、4个平民

### 特殊规则
- 骑士白天可以决斗一名玩家，输了自己死亡，赢了对方死亡（全局一次）
- 狼美人夜间可以魅惑一名玩家，若狼美人死亡则目标连结死亡
- 守卫每晚可以守护一人，不能连续守护同一人
- 女巫有解药和毒药各一瓶，可以救人或毒人

### 胜利条件
- **狼人胜利**：屠杀所有好人或屠杀所有神职
- **好人胜利**：放逐所有狼人

### 技能优先级
1. 守卫守护
2. 狼刀
3. 女巫解救/毒杀
4. 预言家查验
5. 狼美人魅惑
6. 结算死亡
7. 骑士决斗（白天）

### 策略提示
- 骑士需要精准判断身份再决斗，一旦失误将损失强力神职
- 狼美人魅惑后形成连结，好人需警惕盲目放逐
- 守卫守护限制增加操作难度，需要预判狼刀目标
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  /**
   * 守墓人石像鬼剧本
   * 配置：守墓人、石像鬼（独狼）、预言家、女巫、猎人、3个普通狼人、4民
   */
  static readonly GRAVEKEEPER_GARGOYLE_SCRIPT: ScriptV2 = {
    id: 'gravekeeper-gargoyle',
    name: '守墓人石像鬼剧本',
    description: '守墓人验尸与石像鬼独狼的信息争夺',
    playerCount: 12,

    roleComposition: {
      wolf: 3,         // 普通狼人
      gargoyle: 1,     // 石像鬼（独狼）
      gravekeeper: 1,  // 守墓人
      seer: 1,         // 预言家
      witch: 1,        // 女巫
      hunter: 1,       // 猎人
      villager: 4,     // 平民
    },

    ruleVariants: {
      winConditions: {
        type: 'standard',
      },
    },

    difficulty: 'hard',
    tags: ['守墓人', '石像鬼', '独狼', '信息局'],
    rules: `
## 剧本规则

### 阵营配置
- **狼人阵营（4人）**：石像鬼（独狼）+ 3个普通狼人
- **好人阵营（8人）**：守墓人、预言家、女巫、猎人、4个平民

### 特殊规则
- **石像鬼**（独狼，狼队大哥）：
  - 每晚可以查验一名玩家的**具体角色**（比预言家更强）
  - **不参与狼刀**，不与小狼夜晚见面
  - 只要小狼未全死，石像鬼不带刀
  - 拥有最强的信息获取能力
- **守墓人**：可以验尸，得知死者身份（好人/狼人）
- **女巫**：有解药和毒药各一瓶
- **猎人**：死亡可以开枪

### 胜利条件
- **狼人胜利**：屠杀所有好人或屠杀所有神职
- **好人胜利**：放逐所有狼人（包括石像鬼）

### 技能优先级
1. 石像鬼查验
2. 狼刀（石像鬼不参与）
3. 守墓人验尸（结算后）
4. 女巫解救/毒杀
5. 预言家查验
6. 结算死亡

### 策略提示
- **石像鬼**是独狼，信息量极大，可以精准找神，但需要隐藏身份
- **守墓人**通过验尸获得关键身份信息，与预言家形成双查验体系
- **预言家**和石像鬼的信息对抗是本局核心，谁先找到对方是关键
- 石像鬼可能会假装预言家混淆视听，好人需要仔细分辨
- 狼人阵营虽然只有4人，但石像鬼的强大查验能力可以弥补人数劣势
`,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
