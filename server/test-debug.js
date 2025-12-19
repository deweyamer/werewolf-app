import { RoleRegistry } from './src/game/roles/RoleRegistry.js';

console.log('All Role IDs:', RoleRegistry.getAllRoleIds());
console.log('All Role Names:', RoleRegistry.getAllRoleNames());
console.log('\nTesting getHandler:');
console.log('wolf:', RoleRegistry.getHandler('wolf')?.roleId);
console.log('nightmare:', RoleRegistry.getHandler('nightmare')?.roleId);
console.log('seer:', RoleRegistry.getHandler('seer')?.roleId);
console.log('villager:', RoleRegistry.getHandler('villager')?.roleId);
