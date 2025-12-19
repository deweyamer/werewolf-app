import fs from 'fs/promises';
import path from 'path';
import { Script } from '../../../shared/src/types.js';
import { DEFAULT_SCRIPT_ID } from '../../../shared/src/constants.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCRIPTS_FILE = path.join(DATA_DIR, 'scripts.json');

export class ScriptService {
  private scripts: Script[] = [];

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadScripts();
    await this.ensureDefaultScript();
  }

  private async loadScripts() {
    try {
      const data = await fs.readFile(SCRIPTS_FILE, 'utf-8');
      this.scripts = JSON.parse(data);
    } catch (error) {
      this.scripts = [];
    }
  }

  private async saveScripts() {
    await fs.writeFile(SCRIPTS_FILE, JSON.stringify(this.scripts, null, 2));
  }

  private async ensureDefaultScript() {
    if (this.scripts.some(s => s.id === DEFAULT_SCRIPT_ID)) return;

    const defaultScript: Script = {
      id: DEFAULT_SCRIPT_ID,
      name: '摄梦人12人版',
      description: '包含摄梦人和噩梦之影的12人村规版本',
      playerCount: 12,
      roles: [
        {
          id: 'nightmare',
          name: '噩梦之影',
          camp: 'wolf',
          count: 1,
          description: '狼人阵营，每晚可以恐惧一名玩家，使其无法使用技能',
          abilities: [
            {
              id: 'fear',
              name: '恐惧',
              description: '使目标玩家无法使用技能',
              targetRequired: true,
              canSkip: true,
            },
          ],
        },
        {
          id: 'wolf',
          name: '普通狼人',
          camp: 'wolf',
          count: 3,
          description: '狼人阵营，每晚集体投票杀死一名玩家',
          abilities: [
            {
              id: 'kill',
              name: '刀人',
              description: '狼人集体投票杀死一名玩家',
              targetRequired: true,
            },
          ],
        },
        {
          id: 'dreamer',
          name: '摄梦人',
          camp: 'good',
          count: 1,
          description: '好人阵营，每晚可以守护一名玩家，使其免受狼人伤害。被守护者若被狼人刀中，则摄梦人代替其死亡',
          abilities: [
            {
              id: 'dream',
              name: '守护',
              description: '守护一名玩家，若其被刀则摄梦人替死',
              targetRequired: true,
            },
          ],
        },
        {
          id: 'witch',
          name: '女巫',
          camp: 'good',
          count: 1,
          description: '好人阵营，拥有一瓶解药和一瓶毒药。解药可以救活当晚被杀的玩家，毒药可以毒死一名玩家',
          abilities: [
            {
              id: 'antidote',
              name: '解药',
              description: '救活当晚被狼人杀死的玩家',
              targetRequired: false,
              canSkip: true,
            },
            {
              id: 'poison',
              name: '毒药',
              description: '毒死一名玩家',
              targetRequired: true,
              canSkip: true,
            },
          ],
        },
        {
          id: 'seer',
          name: '预言家',
          camp: 'good',
          count: 1,
          description: '好人阵营，每晚可以查验一名玩家的身份',
          abilities: [
            {
              id: 'check',
              name: '查验',
              description: '查验一名玩家是好人还是狼人',
              targetRequired: true,
            },
          ],
        },
        {
          id: 'hunter',
          name: '猎人',
          camp: 'good',
          count: 1,
          description: '好人阵营，死亡时可以开枪带走一名玩家',
          abilities: [
            {
              id: 'shoot',
              name: '开枪',
              description: '死亡时可以带走一名玩家',
              targetRequired: true,
              canSkip: true,
            },
          ],
        },
        {
          id: 'villager',
          name: '平民',
          camp: 'good',
          count: 4,
          description: '好人阵营，没有特殊能力',
          abilities: [],
        },
      ],
      phases: [
        { id: 'lobby', name: '大厅', description: '等待玩家加入', order: 0, isNightPhase: false },
        { id: 'fear', name: '恐惧阶段', description: '噩梦之影恐惧一名玩家', order: 1, isNightPhase: true, actorRole: 'nightmare' },
        { id: 'dream', name: '守护阶段', description: '摄梦人守护一名玩家', order: 2, isNightPhase: true, actorRole: 'dreamer' },
        { id: 'wolf', name: '狼人阶段', description: '狼人刀人', order: 3, isNightPhase: true, actorRole: 'wolf' },
        { id: 'witch', name: '女巫阶段', description: '女巫使用药水', order: 4, isNightPhase: true, actorRole: 'witch' },
        { id: 'seer', name: '预言家阶段', description: '预言家查验身份', order: 5, isNightPhase: true, actorRole: 'seer' },
        { id: 'settle', name: '夜间结算', description: '结算夜间死亡', order: 6, isNightPhase: false },
        { id: 'sheriffElection', name: '警长竞选', description: '选举警长', order: 7, isNightPhase: false },
        { id: 'vote', name: '投票放逐', description: '投票放逐一名玩家', order: 8, isNightPhase: false },
        { id: 'hunter', name: '猎人开枪', description: '猎人死亡时开枪', order: 9, isNightPhase: false, actorRole: 'hunter' },
        { id: 'daySettle', name: '白天结算', description: '结算白天死亡', order: 10, isNightPhase: false },
        { id: 'finished', name: '游戏结束', description: '游戏结束', order: 11, isNightPhase: false },
      ],
      rules: `# 摄梦人12人版规则

## 角色配置
- **狼人阵营（4人）**：1噩梦之影 + 3普通狼人
- **好人阵营（8人）**：1摄梦人 + 1女巫 + 1预言家 + 1猎人 + 4平民

## 特殊规则
1. **噩梦之影**：每晚恐惧一名玩家，使其无法使用技能
2. **摄梦人**：每晚守护一名玩家，若其被刀则摄梦人替死
3. **女巫**：首夜不救则被刀者死亡
4. **警长**：首夜后竞选，拥有1.5票投票权，死亡可传递警徽

## 胜利条件
- **狼人胜利**：狼人数量 >= 好人数量
- **好人胜利**：所有狼人出局
`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.scripts.push(defaultScript);
    await this.saveScripts();
  }

  getScript(scriptId: string): Script | undefined {
    return this.scripts.find(s => s.id === scriptId);
  }

  listScripts(): Script[] {
    return this.scripts;
  }

  async createScript(script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'>): Promise<Script> {
    const newScript: Script = {
      ...script,
      id: `custom-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.scripts.push(newScript);
    await this.saveScripts();
    return newScript;
  }

  async updateScript(scriptId: string, updates: Partial<Omit<Script, 'id' | 'createdAt'>>): Promise<Script | null> {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return null;

    Object.assign(script, updates, { updatedAt: new Date().toISOString() });
    await this.saveScripts();
    return script;
  }

  async deleteScript(scriptId: string): Promise<boolean> {
    const index = this.scripts.findIndex(s => s.id === scriptId);
    if (index === -1) return false;

    this.scripts.splice(index, 1);
    await this.saveScripts();
    return true;
  }
}
