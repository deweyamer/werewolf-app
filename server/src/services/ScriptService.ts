import fs from 'fs/promises';
import path from 'path';
import { ScriptV2, ScriptWithPhases } from '../game/script/ScriptTypes.js';
import { ScriptPhaseGenerator } from '../game/script/ScriptPhaseGenerator.js';
import { ScriptValidator } from '../game/script/ScriptValidator.js';
import { ScriptPresets } from '../game/script/ScriptPresets.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCRIPTS_FILE = path.join(DATA_DIR, 'scripts_v2.json');

/**
 * ScriptService - 剧本管理服务（新架构）
 * 核心职责：
 * 1. 管理剧本配置（ScriptV2）
 * 2. 动态生成阶段配置（通过ScriptPhaseGenerator）
 * 3. 验证剧本合法性（通过ScriptValidator）
 * 4. 提供预设剧本库（通过ScriptPresets）
 */
export class ScriptService {
  private scripts: ScriptV2[] = [];
  private phaseGenerator = new ScriptPhaseGenerator();
  private validator = new ScriptValidator();

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadScripts();
    await this.ensurePresetScripts();
  }

  /**
   * 从文件加载剧本
   */
  private async loadScripts() {
    try {
      const data = await fs.readFile(SCRIPTS_FILE, 'utf-8');
      this.scripts = JSON.parse(data);
    } catch (error) {
      // 文件不存在或格式错误，初始化为空
      this.scripts = [];
    }
  }

  /**
   * 保存剧本到文件
   */
  private async saveScripts() {
    await fs.writeFile(SCRIPTS_FILE, JSON.stringify(this.scripts, null, 2));
  }

  /**
   * 确保预设剧本存在
   */
  private async ensurePresetScripts() {
    const presets = ScriptPresets.getAllPresets();
    let hasChanges = false;

    for (const preset of presets) {
      // 检查是否已存在（通过ID）
      const exists = this.scripts.some(s => s.id === preset.id);
      if (!exists) {
        this.scripts.push(preset);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.saveScripts();
    }
  }

  /**
   * 获取剧本（带动态生成的phases）
   */
  getScript(scriptId: string): ScriptWithPhases | undefined {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return undefined;

    const phases = this.phaseGenerator.generatePhases(script);
    return { script, phases };
  }

  /**
   * 列出所有剧本（不含phases，减少数据量）
   */
  listScripts(): ScriptV2[] {
    return this.scripts;
  }

  /**
   * 创建自定义剧本
   */
  async createScript(scriptData: Omit<ScriptV2, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean;
    script?: ScriptV2;
    errors?: string[];
    warnings?: string[];
  }> {
    // 构建完整剧本对象
    const newScript: ScriptV2 = {
      ...scriptData,
      id: `custom-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 验证剧本
    const validationResult = this.validator.validate(newScript);
    if (!validationResult.valid) {
      return {
        success: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      };
    }

    // 验证通过，保存剧本
    this.scripts.push(newScript);
    await this.saveScripts();

    return {
      success: true,
      script: newScript,
      warnings: validationResult.warnings,
    };
  }

  /**
   * 更新剧本
   */
  async updateScript(
    scriptId: string,
    updates: Partial<Omit<ScriptV2, 'id' | 'createdAt'>>
  ): Promise<{
    success: boolean;
    script?: ScriptV2;
    errors?: string[];
    warnings?: string[];
  }> {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) {
      return {
        success: false,
        errors: ['剧本不存在'],
      };
    }

    // 构建更新后的剧本
    const updatedScript: ScriptV2 = {
      ...script,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // 验证剧本
    const validationResult = this.validator.validate(updatedScript);
    if (!validationResult.valid) {
      return {
        success: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      };
    }

    // 更新剧本
    Object.assign(script, updatedScript);
    await this.saveScripts();

    return {
      success: true,
      script,
      warnings: validationResult.warnings,
    };
  }

  /**
   * 删除剧本（不允许删除预设剧本）
   */
  async deleteScript(scriptId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    // 检查是否是预设剧本
    const isPreset = ScriptPresets.getAllPresets().some(p => p.id === scriptId);
    if (isPreset) {
      return {
        success: false,
        error: '不能删除预设剧本',
      };
    }

    const index = this.scripts.findIndex(s => s.id === scriptId);
    if (index === -1) {
      return {
        success: false,
        error: '剧本不存在',
      };
    }

    this.scripts.splice(index, 1);
    await this.saveScripts();

    return { success: true };
  }

  /**
   * 验证剧本（不保存）
   */
  validateScript(script: ScriptV2) {
    return this.validator.validate(script);
  }

  /**
   * 获取所有预设剧本
   */
  getPresetScripts(): ScriptV2[] {
    return ScriptPresets.getAllPresets();
  }

  /**
   * 预览剧本的阶段配置（用于调试/展示）
   */
  previewPhases(scriptId: string) {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return null;

    return this.phaseGenerator.generatePhases(script);
  }

  /**
   * 获取夜间行动角色列表（用于前端显示）
   */
  getNightActionRoles(scriptId: string): string[] | null {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return null;

    return this.phaseGenerator.getNightActionRoles(script.roleComposition);
  }

  /**
   * 注册临时自定义剧本（用于即时创建房间，不保存到文件）
   * 返回剧本ID，如果验证失败则返回null
   */
  registerCustomScript(scriptData: ScriptV2): string | null {
    // 验证剧本
    const validationResult = this.validator.validate(scriptData);
    if (!validationResult.valid) {
      console.error('[Custom Script] 验证失败:', validationResult.errors);
      return null;
    }

    // 确保ID唯一
    const script: ScriptV2 = {
      ...scriptData,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 添加到内存中（不保存到文件）
    this.scripts.push(script);

    console.log(`[Custom Script] 注册临时剧本: ${script.id} (${script.playerCount}人)`);
    return script.id;
  }
}
