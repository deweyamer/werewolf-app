import { Game } from '../../../../shared/src/types';
import { NightActionsSummary } from '../../utils/gameStats';

interface NightActionsPanelProps {
  currentGame: Game;
  nightActionsSummary: NightActionsSummary;
}

export default function NightActionsPanel({ currentGame, nightActionsSummary }: NightActionsPanelProps) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
      <h4 className="text-xl font-bold text-white mb-4">夜晚操作状态</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 恐惧阶段 */}
        {nightActionsSummary.fear && (
          <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">噩梦之影 ({nightActionsSummary.fear.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.fear.submitted ? (
                <div className="text-green-400">
                  已选择: {nightActionsSummary.fear.targetId ? `${nightActionsSummary.fear.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 摄梦人阶段 */}
        {nightActionsSummary.dream && (
          <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">摄梦人 ({nightActionsSummary.dream.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.dream.submitted ? (
                <div className="text-green-400">
                  已摄梦: {nightActionsSummary.dream.targetId ? `${nightActionsSummary.dream.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 石像鬼阶段 */}
        {nightActionsSummary.gargoyle && (
          <div className="p-4 bg-purple-600/20 border border-purple-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">石像鬼 ({nightActionsSummary.gargoyle.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.gargoyle.submitted ? (
                <div className="text-green-400">
                  已查验: {nightActionsSummary.gargoyle.targetId ? `${nightActionsSummary.gargoyle.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 守卫阶段 */}
        {nightActionsSummary.guard && (
          <div className="p-4 bg-blue-600/20 border border-blue-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">守卫 ({nightActionsSummary.guard.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.guard.submitted ? (
                <div className="text-green-400">
                  已守护: {nightActionsSummary.guard.targetId ? `${nightActionsSummary.guard.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 狼人阶段 */}
        {nightActionsSummary.wolf && (
          <div className="p-4 bg-red-600/20 border border-red-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">狼人刀人</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.wolf.submitted ? (
                <>
                  <div className="text-green-400">
                    已刀: {nightActionsSummary.wolf.targetId ? `${nightActionsSummary.wolf.targetId}号` : '无目标'}
                  </div>
                  {nightActionsSummary.wolf.voters && nightActionsSummary.wolf.voters.length > 0 && (
                    <div className="text-gray-400 text-xs mt-1">
                      投票: {nightActionsSummary.wolf.voters.join(', ')}号
                    </div>
                  )}
                </>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 狼美人阶段 */}
        {nightActionsSummary.wolfBeauty && (
          <div className="p-4 bg-pink-600/20 border border-pink-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">狼美人 ({nightActionsSummary.wolfBeauty.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.wolfBeauty.submitted ? (
                <div className="text-green-400">
                  已魅惑: {nightActionsSummary.wolfBeauty.targetId ? `${nightActionsSummary.wolfBeauty.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 女巫阶段 */}
        {nightActionsSummary.witch && (
          <div className="p-4 bg-green-600/20 border border-green-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">女巫 ({nightActionsSummary.witch.actorId}号)</h4>
            <div className="text-gray-300 text-sm space-y-1">
              {nightActionsSummary.witch.victimId && (
                <div className="text-red-300">昨晚被刀: {nightActionsSummary.witch.victimId}号</div>
              )}
              {nightActionsSummary.witch.submitted ? (
                <>
                  <div className="text-green-400">已操作</div>
                  {nightActionsSummary.witch.action === 'save' && (
                    <div className="text-blue-400">使用了解药</div>
                  )}
                  {nightActionsSummary.witch.action === 'poison' && (
                    <div className="text-red-400">使用了毒药毒死 {nightActionsSummary.witch.targetId}号</div>
                  )}
                  {nightActionsSummary.witch.action === 'none' && (
                    <div className="text-gray-400">不使用药水</div>
                  )}
                </>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 预言家阶段 */}
        {nightActionsSummary.seer && (
          <div className="p-4 bg-cyan-600/20 border border-cyan-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">预言家 ({nightActionsSummary.seer.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {nightActionsSummary.seer.submitted ? (
                <>
                  <div className="text-green-400">已查验</div>
                  {nightActionsSummary.seer.targetId && (
                    <div>
                      查验 {nightActionsSummary.seer.targetId}号 →{' '}
                      <span className={nightActionsSummary.seer.result === 'wolf' ? 'text-red-400' : 'text-blue-400'}>
                        {nightActionsSummary.seer.result === 'wolf' ? '狼人' : '好人'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}

        {/* 守墓人阶段 */}
        {nightActionsSummary.gravekeeper && (
          <div className="p-4 bg-gray-600/20 border border-gray-500/50 rounded-lg">
            <h4 className="text-white font-bold mb-2">守墓人 ({nightActionsSummary.gravekeeper.actorId}号)</h4>
            <div className="text-gray-300 text-sm">
              {/* 守墓人规则提示 */}
              <div className="text-yellow-400 text-xs mb-2">
                守墓人只能验尸白天被投票放逐的玩家
              </div>
              {/* 显示可验尸的玩家列表 */}
              {(() => {
                const exiledPlayers = currentGame.players.filter(
                  p => !p.alive && p.outReason === 'exile'
                );
                return exiledPlayers.length > 0 ? (
                  <div className="text-gray-400 text-xs mb-2">
                    可验尸: {exiledPlayers.map(p => `${p.playerId}号`).join(', ')}
                  </div>
                ) : (
                  <div className="text-gray-500 text-xs mb-2">
                    可验尸: 无 (尚无被放逐的玩家)
                  </div>
                );
              })()}
              {nightActionsSummary.gravekeeper.submitted ? (
                <div className="text-green-400">
                  已验尸: {nightActionsSummary.gravekeeper.targetId ? `${nightActionsSummary.gravekeeper.targetId}号` : '无目标'}
                </div>
              ) : (
                <div className="text-yellow-400">等待操作...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
