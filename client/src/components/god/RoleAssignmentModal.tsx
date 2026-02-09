import { useMemo } from 'react';
import { Game, ScriptV2 } from '../../../../shared/src/types';

interface RoleInfo {
  id: string;
  name: string;
  camp: string;
  count: number;
  abilities: string[];
  description: string;
}

interface RoleAssignmentModalProps {
  show: boolean;
  onClose: () => void;
  currentGame: Game;
  currentScript: ScriptV2 | undefined;
  currentScriptRoles: RoleInfo[];
  roleAssignments: { [key: number]: string };
  setRoleAssignments: (assignments: { [key: number]: string }) => void;
  onRandomAssign: () => void;
  onAssignRoles: () => void;
}

export default function RoleAssignmentModal({
  show,
  onClose,
  currentGame,
  currentScript,
  currentScriptRoles,
  roleAssignments,
  setRoleAssignments,
  onRandomAssign,
  onAssignRoles,
}: RoleAssignmentModalProps) {
  if (!show || !currentScript || currentScriptRoles.length === 0) return null;

  // 计算每个角色的已分配数量和剩余数量
  const roleUsage = useMemo(() => {
    const usage: { [roleId: string]: { assigned: number; max: number } } = {};
    currentScriptRoles.forEach(role => {
      usage[role.id] = { assigned: 0, max: role.count };
    });
    Object.values(roleAssignments).forEach(roleId => {
      if (roleId && usage[roleId]) {
        usage[roleId].assigned++;
      }
    });
    return usage;
  }, [roleAssignments, currentScriptRoles]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">分配角色</h3>
          <button
            onClick={onRandomAssign}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
          >
            🎲 随机分配
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
          <h4 className="text-white font-bold mb-2">剧本配置：{currentScript?.name}</h4>
          <div className="text-gray-200 text-sm space-y-1">
            {currentScriptRoles.map(role => {
              const usage = roleUsage[role.id];
              const isFull = usage && usage.assigned >= usage.max;
              return (
                <div key={role.id} className="flex justify-between">
                  <span>
                    {role.name} x{role.count}
                    {usage && (
                      <span className={`ml-2 ${isFull ? 'text-green-400' : 'text-yellow-400'}`}>
                        ({usage.assigned}/{usage.max})
                      </span>
                    )}
                  </span>
                  <span className={role.camp === 'wolf' ? 'text-red-300' : 'text-green-300'}>
                    ({role.camp === 'wolf' ? '狼人' : '好人'})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {[...currentGame.players].sort((a, b) => a.playerId - b.playerId).map((player) => (
            <div key={player.playerId} className="flex items-center gap-4">
              <div className="text-white w-32">{player.playerId}号 - {player.username}</div>
              <select
                value={roleAssignments[player.playerId] || ''}
                onChange={(e) =>
                  setRoleAssignments({ ...roleAssignments, [player.playerId]: e.target.value })
                }
                className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
              >
                <option value="" className="text-gray-900 bg-white">选择角色</option>
                {currentScriptRoles.map((role) => {
                  const usage = roleUsage[role.id];
                  const currentPlayerHasThis = roleAssignments[player.playerId] === role.id;
                  const isFull = usage && usage.assigned >= usage.max && !currentPlayerHasThis;
                  return (
                    <option
                      key={role.id}
                      value={role.id}
                      disabled={isFull}
                      className="text-gray-900 bg-white"
                    >
                      {role.name} ({role.camp === 'wolf' ? '狼人' : '好人'})
                      {usage && ` [${usage.assigned}/${usage.max}]`}
                      {isFull ? ' - 已满' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={onAssignRoles}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
          >
            确认分配
          </button>
        </div>
      </div>
    </div>
  );
}
