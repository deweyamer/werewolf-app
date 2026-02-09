import { useState, useMemo, useEffect } from 'react';
import { ROLE_INFO, RoleInfo } from '../../../shared/src/constants';
import { useToast } from './Toast';

interface RoleSelectorProps {
  onComplete: (composition: { [roleId: string]: number }, playerCount: number) => void;
  onCancel: () => void;
}

// 人数预设选项
const PLAYER_COUNT_OPTIONS = [6, 9, 12, 15, 18];

// 阵营平衡规则
function getBalanceRules(playerCount: number): { minWolves: number; maxWolves: number } {
  if (playerCount <= 6) return { minWolves: 2, maxWolves: 2 };
  if (playerCount <= 9) return { minWolves: 2, maxWolves: 3 };
  if (playerCount <= 12) return { minWolves: 3, maxWolves: 4 };
  if (playerCount <= 15) return { minWolves: 4, maxWolves: 5 };
  return { minWolves: 5, maxWolves: 6 };
}

// 按阵营分组角色
function groupRolesByCamp() {
  const wolves: RoleInfo[] = [];
  const gods: RoleInfo[] = [];
  const villagers: RoleInfo[] = [];

  Object.values(ROLE_INFO).forEach((role) => {
    if (role.camp === 'wolf') {
      wolves.push(role);
    } else if (role.id === 'villager') {
      villagers.push(role);
    } else {
      gods.push(role);
    }
  });

  return { wolves, gods, villagers };
}

export default function RoleSelector({ onComplete, onCancel }: RoleSelectorProps) {
  const toast = useToast();
  const [playerCount, setPlayerCount] = useState(12);
  const [selectedRoles, setSelectedRoles] = useState<{ [roleId: string]: number }>({});
  const [customPlayerCount, setCustomPlayerCount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const { wolves, gods, villagers } = useMemo(() => groupRolesByCamp(), []);

  // 计算当前统计
  const stats = useMemo(() => {
    let wolfCount = 0;
    let godCount = 0;
    let villagerCount = 0;

    Object.entries(selectedRoles).forEach(([roleId, count]) => {
      const role = ROLE_INFO[roleId];
      if (!role) return;
      if (role.camp === 'wolf') {
        wolfCount += count;
      } else if (roleId === 'villager') {
        villagerCount += count;
      } else {
        godCount += count;
      }
    });

    return {
      wolfCount,
      godCount,
      villagerCount,
      totalCount: wolfCount + godCount + villagerCount,
    };
  }, [selectedRoles]);

  // 验证配置
  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { minWolves, maxWolves } = getBalanceRules(playerCount);

    // 检查总人数
    if (stats.totalCount !== playerCount) {
      errors.push(`需要${playerCount}人，当前${stats.totalCount}人`);
    }

    // 检查狼人数量
    if (stats.wolfCount < minWolves) {
      errors.push(`狼人至少需要${minWolves}人`);
    } else if (stats.wolfCount > maxWolves) {
      errors.push(`狼人最多${maxWolves}人`);
    }

    // 警告：没有预言家
    if (!selectedRoles['seer']) {
      warnings.push('没有预言家，好人信息获取困难');
    }

    // 警告：没有女巫
    if (!selectedRoles['witch']) {
      warnings.push('没有女巫，好人容错率较低');
    }

    // 警告：平民太少
    if (stats.villagerCount < 2) {
      warnings.push('建议至少配置2个平民');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }, [playerCount, stats, selectedRoles]);

  // 处理人数变化 - 重置角色选择
  useEffect(() => {
    setSelectedRoles({});
  }, [playerCount]);

  // 更新角色数量
  const updateRoleCount = (roleId: string, delta: number) => {
    setSelectedRoles((prev) => {
      const current = prev[roleId] || 0;
      const newCount = Math.max(0, current + delta);

      // 如果新数量为0，删除该键
      if (newCount === 0) {
        const { [roleId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [roleId]: newCount };
    });
  };

  // 快速填充：自动填充平民到指定人数
  const autoFillVillagers = () => {
    const remaining = playerCount - stats.totalCount + (selectedRoles['villager'] || 0);
    if (remaining > 0) {
      setSelectedRoles((prev) => ({
        ...prev,
        villager: remaining,
      }));
    }
  };

  // 快速重置
  const resetAll = () => {
    setSelectedRoles({});
  };

  // 提交配置
  const handleSubmit = () => {
    if (!validation.valid) {
      toast('配置无效，请检查错误提示', 'warning');
      return;
    }
    onComplete(selectedRoles, playerCount);
  };

  // 处理自定义人数输入
  const handleCustomPlayerCount = () => {
    const count = parseInt(customPlayerCount);
    if (count >= 6 && count <= 18) {
      setPlayerCount(count);
      setShowCustomInput(false);
      setCustomPlayerCount('');
    } else {
      toast('人数必须在6-18之间', 'warning');
    }
  };

  const { minWolves, maxWolves } = getBalanceRules(playerCount);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-3xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">自定义剧本</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* 第一步：选择人数 */}
        <div className="mb-6">
          <h4 className="text-lg font-bold text-white mb-3">第一步：选择人数</h4>
          <div className="flex flex-wrap gap-2">
            {PLAYER_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`px-4 py-2 rounded-lg transition ${
                  playerCount === count
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {count}人
              </button>
            ))}
            {showCustomInput ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customPlayerCount}
                  onChange={(e) => setCustomPlayerCount(e.target.value)}
                  placeholder="6-18"
                  min={6}
                  max={18}
                  className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white"
                />
                <button
                  onClick={handleCustomPlayerCount}
                  className="px-3 py-1 bg-green-600 text-white rounded"
                >
                  确定
                </button>
                <button
                  onClick={() => setShowCustomInput(false)}
                  className="px-3 py-1 bg-gray-600 text-white rounded"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomInput(true)}
                className={`px-4 py-2 rounded-lg transition ${
                  !PLAYER_COUNT_OPTIONS.includes(playerCount)
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {!PLAYER_COUNT_OPTIONS.includes(playerCount) ? `${playerCount}人` : '自定义'}
              </button>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2">
            {playerCount}人局推荐: {minWolves}-{maxWolves}狼, {playerCount - maxWolves}好人
          </p>
        </div>

        {/* 第二步：选择角色 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-bold text-white">
              第二步：选择角色 ({stats.totalCount}/{playerCount}人)
            </h4>
            <div className="flex gap-2">
              <button
                onClick={autoFillVillagers}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition"
              >
                自动填充平民
              </button>
              <button
                onClick={resetAll}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition"
              >
                重置
              </button>
            </div>
          </div>

          {/* 狼人阵营 */}
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <h5 className="text-red-300 font-bold mb-3">
              狼人阵营 (需要{minWolves}-{maxWolves}人，当前{stats.wolfCount}人)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {wolves.map((role) => (
                <RoleItem
                  key={role.id}
                  role={role}
                  count={selectedRoles[role.id] || 0}
                  onIncrease={() => updateRoleCount(role.id, 1)}
                  onDecrease={() => updateRoleCount(role.id, -1)}
                />
              ))}
            </div>
          </div>

          {/* 神职 */}
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <h5 className="text-blue-300 font-bold mb-3">
              神职 (当前{stats.godCount}人)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {gods.map((role) => (
                <RoleItem
                  key={role.id}
                  role={role}
                  count={selectedRoles[role.id] || 0}
                  onIncrease={() => updateRoleCount(role.id, 1)}
                  onDecrease={() => updateRoleCount(role.id, -1)}
                />
              ))}
            </div>
          </div>

          {/* 平民 */}
          <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
            <h5 className="text-green-300 font-bold mb-3">
              平民 (当前{stats.villagerCount}人)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {villagers.map((role) => (
                <RoleItem
                  key={role.id}
                  role={role}
                  count={selectedRoles[role.id] || 0}
                  onIncrease={() => updateRoleCount(role.id, 1)}
                  onDecrease={() => updateRoleCount(role.id, -1)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 验证结果 */}
        <div className="mb-6 p-4 bg-white/5 rounded-lg">
          <h4 className="text-white font-bold mb-2">验证结果</h4>
          {validation.errors.length > 0 && (
            <div className="mb-2">
              {validation.errors.map((error, i) => (
                <div key={i} className="text-red-400 text-sm flex items-center gap-2">
                  <span className="text-red-500">✗</span> {error}
                </div>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="mb-2">
              {validation.warnings.map((warning, i) => (
                <div key={i} className="text-yellow-400 text-sm flex items-center gap-2">
                  <span className="text-yellow-500">⚠</span> {warning}
                </div>
              ))}
            </div>
          )}
          {validation.valid && validation.warnings.length === 0 && (
            <div className="text-green-400 text-sm flex items-center gap-2">
              <span className="text-green-500">✓</span> 配置有效
            </div>
          )}
          {validation.valid && validation.warnings.length > 0 && (
            <div className="text-green-400 text-sm flex items-center gap-2 mt-2">
              <span className="text-green-500">✓</span> 配置有效（有警告）
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!validation.valid}
            className={`flex-1 py-3 font-bold rounded-lg transition ${
              validation.valid
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-500 text-gray-300 cursor-not-allowed'
            }`}
          >
            创建剧本
          </button>
        </div>
      </div>
    </div>
  );
}

// 角色项组件
interface RoleItemProps {
  role: RoleInfo;
  count: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

function RoleItem({ role, count, onIncrease, onDecrease }: RoleItemProps) {
  return (
    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{role.name}</span>
          {role.abilities.length > 0 && (
            <span className="text-gray-500 text-xs">
              ({role.abilities.slice(0, 2).join('、')})
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDecrease}
          disabled={count === 0}
          className={`w-8 h-8 rounded-full font-bold transition ${
            count === 0
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-600 hover:bg-gray-500 text-white'
          }`}
        >
          -
        </button>
        <span className="w-8 text-center text-white font-bold">{count}</span>
        <button
          onClick={onIncrease}
          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
