import { Game, RoundHistoryEntry } from '../../../../shared/src/types';
import { getRoleName, translateDeathReason } from '../../utils/phaseLabels';

interface HistorySnapshotPanelProps {
  roundEntry: RoundHistoryEntry;
  game: Game;
  period: 'night' | 'day';
}

export default function HistorySnapshotPanel({ roundEntry, game, period }: HistorySnapshotPanelProps) {
  if (period === 'night') {
    return <NightSnapshot roundEntry={roundEntry} game={game} />;
  }
  return <DaySnapshot roundEntry={roundEntry} game={game} />;
}

function NightSnapshot({ roundEntry, game }: { roundEntry: RoundHistoryEntry; game: Game }) {
  const na = roundEntry.nightActions;

  return (
    <div className="bg-indigo-900/30 backdrop-blur-md rounded-2xl p-6 border border-indigo-500/30 space-y-4">
      <h4 className="text-xl font-bold text-indigo-300">
        {'\u{1F319}'} 第{roundEntry.round}晚 — 夜晚操作回顾
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Wolf kill */}
        {na.wolfKill !== undefined && (
          <ActionCard color="red" title="狼人刀人">
            目标: {na.wolfKill}号 ({getPlayerName(game, na.wolfKill)})
          </ActionCard>
        )}

        {/* Guard */}
        {na.guardTarget !== undefined && (
          <ActionCard color="blue" title="守卫守护">
            守护: {na.guardTarget}号 ({getPlayerName(game, na.guardTarget)})
          </ActionCard>
        )}

        {/* Seer */}
        {na.seerCheck !== undefined && (
          <ActionCard color="cyan" title="预言家查验">
            查验: {na.seerCheck}号 —{' '}
            <span className={na.seerResult === 'wolf' ? 'text-red-400' : 'text-blue-400'}>
              {na.seerResult === 'wolf' ? '狼人' : '好人'}
            </span>
          </ActionCard>
        )}

        {/* Witch */}
        {na.witchAction && na.witchAction !== 'none' && (
          <ActionCard color="green" title="女巫用药">
            {na.witchAction === 'save' ? '使用解药' : `毒死 ${na.witchTarget}号`}
          </ActionCard>
        )}
        {na.witchAction === 'none' && (
          <ActionCard color="green" title="女巫用药">
            <span className="text-gray-400">未使用药水</span>
          </ActionCard>
        )}

        {/* Fear */}
        {na.fear !== undefined && (
          <ActionCard color="purple" title="噩梦之影">
            恐惧: {na.fear}号
          </ActionCard>
        )}

        {/* Dream */}
        {na.dream !== undefined && (
          <ActionCard color="blue" title="摄梦人">
            摄梦: {na.dream}号
          </ActionCard>
        )}

        {/* Gargoyle */}
        {na.gargoyleTarget !== undefined && (
          <ActionCard color="purple" title="石像鬼">
            查验: {na.gargoyleTarget}号
          </ActionCard>
        )}

        {/* Wolf Beauty */}
        {na.wolfBeautyTarget !== undefined && (
          <ActionCard color="pink" title="狼美人">
            魅惑: {na.wolfBeautyTarget}号
          </ActionCard>
        )}

        {/* Gravekeeper */}
        {na.gravekeeperTarget !== undefined && (
          <ActionCard color="gray" title="守墓人">
            验尸: {na.gravekeeperTarget}号
          </ActionCard>
        )}
      </div>

      {/* Death summary */}
      <DeathSummary deaths={roundEntry.deaths} game={game} />
    </div>
  );
}

function DaySnapshot({ roundEntry, game }: { roundEntry: RoundHistoryEntry; game: Game }) {
  return (
    <div className="bg-amber-900/20 backdrop-blur-md rounded-2xl p-6 border border-amber-500/30 space-y-4">
      <h4 className="text-xl font-bold text-amber-300">
        {'\u{2600}\u{FE0F}'} 第{roundEntry.round}天 — 白天操作回顾
      </h4>

      {/* Exile vote */}
      {roundEntry.exileVote && (
        <div className="p-4 bg-orange-600/20 border border-orange-500/50 rounded-lg">
          <h5 className="text-white font-bold mb-2">放逐投票</h5>
          <div className="text-sm">
            {roundEntry.exileVote.result === 'none' ? (
              <span className="text-gray-400">无人出局</span>
            ) : roundEntry.exileVote.result === 'tie' ? (
              <span className="text-yellow-400">平票</span>
            ) : (
              <span className="text-orange-300">
                {roundEntry.exileVote.result}号 ({getPlayerName(game, Number(roundEntry.exileVote.result))}) 被放逐
              </span>
            )}
          </div>
          {roundEntry.exileVote.votes && (
            <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-1">
              {Object.entries(roundEntry.exileVote.votes).map(([voterId, target]) => (
                <span key={voterId} className="bg-white/5 px-1.5 py-0.5 rounded">
                  {voterId}号{'\u{2192}'}{target === 'skip' ? '弃票' : `${target}号`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Death summary */}
      <DeathSummary deaths={roundEntry.deaths} game={game} />
    </div>
  );
}

function DeathSummary({ deaths, game }: { deaths: number[]; game: Game }) {
  if (deaths.length === 0) {
    return (
      <div className="p-3 bg-green-600/20 border border-green-500/50 rounded-lg">
        <span className="text-green-400 font-medium">平安 — 本阶段无人死亡</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-red-600/20 border border-red-500/50 rounded-lg">
      <h5 className="text-red-400 font-bold mb-2">死亡</h5>
      <div className="space-y-1">
        {deaths.map(playerId => {
          const player = game.players.find(p => p.playerId === playerId);
          return (
            <div key={playerId} className="flex items-center gap-2 text-sm">
              <span className="text-white font-bold">{playerId}号</span>
              <span className="text-gray-300">{getRoleName(player?.role || '')}</span>
              <span className="text-red-300 text-xs">
                {translateDeathReason(player?.outReason)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({
  color,
  title,
  children,
}: {
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`p-3 bg-${color}-600/20 border border-${color}-500/50 rounded-lg`}>
      <h5 className="text-white font-bold text-sm mb-1">{title}</h5>
      <div className="text-gray-300 text-sm">{children}</div>
    </div>
  );
}

function getPlayerName(game: Game, playerId: number): string {
  const player = game.players.find(p => p.playerId === playerId);
  return player ? getRoleName(player.role || '') : '未知';
}
