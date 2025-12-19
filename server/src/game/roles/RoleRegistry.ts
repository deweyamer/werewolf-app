import { IRoleHandler } from './RoleHandler.js';

// 好人阵营
import { SeerHandler } from './SeerHandler.js';
import { WitchHandler } from './WitchHandler.js';
import { HunterHandler } from './HunterHandler.js';
import { GuardHandler } from './GuardHandler.js';
import { GargoyleHandler } from './GargoyleHandler.js';
import { GravekeeperHandler } from './GravekeeperHandler.js';
import { KnightHandler } from './KnightHandler.js';
import { DreamerHandler } from './DreamerHandler.js';

// 狼人阵营
import { WolfHandler } from './WolfHandler.js';
import { NightmareHandler } from './NightmareHandler.js';
import { WolfBeautyHandler } from './WolfBeautyHandler.js';
import { WhiteWolfHandler } from './WhiteWolfHandler.js';
import { BlackWolfHandler } from './BlackWolfHandler.js';

// 平民（没有技能）
import { VillagerHandler } from './VillagerHandler.js';

/**
 * 角色注册表 - 存储所有角色的处理器
 */
class RoleRegistryClass {
  private handlersByName: Map<string, IRoleHandler> = new Map();
  private handlersById: Map<string, IRoleHandler> = new Map();

  constructor() {
    // 注册好人阵营角色
    this.register(new SeerHandler());           // 预言家
    this.register(new WitchHandler());          // 女巫
    this.register(new HunterHandler());         // 猎人
    this.register(new GuardHandler());          // 守卫
    this.register(new GargoyleHandler());       // 石像鬼
    this.register(new GravekeeperHandler());    // 守墓人
    this.register(new KnightHandler());         // 骑士
    this.register(new DreamerHandler());        // 摄梦人

    // 注册狼人阵营角色
    this.register(new WolfHandler());           // 普通狼人
    this.register(new NightmareHandler());      // 噩梦之影
    this.register(new WolfBeautyHandler());     // 狼美人
    this.register(new WhiteWolfHandler());      // 白狼王
    this.register(new BlackWolfHandler());      // 黑狼王

    // 注册平民
    this.register(new VillagerHandler());       // 平民
  }

  private register(handler: IRoleHandler) {
    // 同时通过roleId和roleName注册
    this.handlersById.set(handler.roleId, handler);
    this.handlersByName.set(handler.roleName, handler);
  }

  /**
   * 根据角色ID或角色名称获取Handler
   * @param roleIdOrName 可以是roleId (如'wolf', 'seer') 或roleName (如'狼人', '预言家')
   */
  getHandler(roleIdOrName: string): IRoleHandler | undefined {
    // 先尝试通过ID查找，再尝试通过名称查找
    return this.handlersById.get(roleIdOrName) || this.handlersByName.get(roleIdOrName);
  }

  /**
   * 获取所有Handler
   */
  getAllHandlers(): IRoleHandler[] {
    return Array.from(this.handlersById.values());
  }

  /**
   * 检查角色是否有夜间行动
   */
  hasNightAction(roleIdOrName: string): boolean {
    const handler = this.getHandler(roleIdOrName);
    return handler?.hasNightAction || false;
  }

  /**
   * 检查角色是否有白天行动
   */
  hasDayAction(roleIdOrName: string): boolean {
    const handler = this.getHandler(roleIdOrName);
    return handler?.hasDayAction || false;
  }

  /**
   * 检查角色是否有死亡触发技能
   */
  hasDeathTrigger(roleIdOrName: string): boolean {
    const handler = this.getHandler(roleIdOrName);
    return handler?.hasDeathTrigger || false;
  }

  /**
   * 获取所有角色ID列表
   */
  getAllRoleIds(): string[] {
    return Array.from(this.handlersById.keys());
  }

  /**
   * 获取所有角色名称列表
   */
  getAllRoleNames(): string[] {
    return Array.from(this.handlersByName.keys());
  }

  /**
   * 按阵营获取角色Handler
   */
  getHandlersByCamp(camp: 'wolf' | 'good'): IRoleHandler[] {
    return this.getAllHandlers().filter(h => h.camp === camp);
  }
}

// 导出单例
export const RoleRegistry = new RoleRegistryClass();
