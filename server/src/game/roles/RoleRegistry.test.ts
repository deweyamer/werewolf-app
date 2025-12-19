import { describe, it, expect } from 'vitest';
import { RoleRegistry } from './RoleRegistry.js';

describe('RoleRegistry', () => {
  it('应该能通过roleId获取handler', () => {
    expect(RoleRegistry.getHandler('wolf')).toBeDefined();
    expect(RoleRegistry.getHandler('seer')).toBeDefined();
    expect(RoleRegistry.getHandler('witch')).toBeDefined();
    expect(RoleRegistry.getHandler('villager')).toBeDefined();
  });

  it('应该返回所有已注册的roleId', () => {
    const roleIds = RoleRegistry.getAllRoleIds();
    console.log('Registered roleIds:', roleIds);

    expect(roleIds).toContain('wolf');
    expect(roleIds).toContain('seer');
    expect(roleIds).toContain('witch');
    expect(roleIds).toContain('hunter');
    expect(roleIds).toContain('guard');
    expect(roleIds).toContain('villager');
    expect(roleIds).toContain('nightmare');
  });

  it('应该返回正确的camp信息', () => {
    const wolfHandler = RoleRegistry.getHandler('wolf');
    const seerHandler = RoleRegistry.getHandler('seer');

    expect(wolfHandler?.camp).toBe('wolf');
    expect(seerHandler?.camp).toBe('good');
  });
});
