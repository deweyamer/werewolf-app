import { Game, GamePlayer, NightSubPhase, WolfChatMessage } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';
import TargetGrid from './TargetGrid';
import CompactWitchPanel from './CompactWitchPanel';
import CompactWolfPanel from './CompactWolfPanel';

const NIGHT_PHASES: NightSubPhase[] = [
  'fear', 'dream', 'gargoyle', 'guard', 'wolf', 'wolf_beauty', 'witch', 'seer', 'gravekeeper', 'settle'
];

interface CompactRoleActionsProps {
  myPlayer: GamePlayer;
  game: Game;
  selectedTarget: number;
  setSelectedTarget: (v: number) => void;
  onSubmitAction: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  wolfChatMessages: WolfChatMessage[];
}

function submitAction(game: Game, player: GamePlayer, actionType: string, target: number) {
  wsService.send({
    type: 'PLAYER_SUBMIT_ACTION',
    action: {
      phase: game.currentPhase,
      playerId: player.playerId,
      actionType,
      target,
    },
  });
}

export default function CompactRoleActions(props: CompactRoleActionsProps) {
  const {
    myPlayer, game, selectedTarget, setSelectedTarget,
    onSubmitAction, isSubmitting, setIsSubmitting, wolfChatMessages,
  } = props;

  const phase = game.currentPhase;
  const role = myPlayer.role;
  const isNight = NIGHT_PHASES.includes(phase as NightSubPhase);

  // 平民/无夜间行动角色在夜间显示等待
  if ((role === 'villager' || !myPlayer.abilities.hasNightAction) && isNight) {
    return (
      <div className="text-center py-6">
        <div className="text-2xl mb-2 opacity-30">🌙</div>
        <p className="text-gray-500 text-sm">天黑请闭眼...</p>
      </div>
    );
  }

  // 噩梦之影 - 恐惧阶段
  if (role === 'nightmare' && phase === 'fear') {
    return (
      <div className="space-y-3">
        <div className="text-gray-400 text-xs">选择恐惧目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
        />
        <div className="flex gap-2">
          <button
            onClick={onSubmitAction}
            disabled={selectedTarget === 0 || isSubmitting}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
          >
            {isSubmitting ? '提交中...' : '确认'}
          </button>
          <button
            onClick={() => { setSelectedTarget(0); submitAction(game, myPlayer, 'skip', 0); }}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition"
          >
            跳过
          </button>
        </div>
      </div>
    );
  }

  // 摄梦人 - 梦游阶段
  if (role === 'dreamer' && phase === 'dream') {
    return (
      <div className="space-y-3">
        {myPlayer.abilities.lastDreamTarget && (
          <div className="text-blue-300/70 text-xs">上晚梦游 {myPlayer.abilities.lastDreamTarget}号</div>
        )}
        <div className="text-gray-400 text-xs">选择梦游目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
        />
        <button
          onClick={onSubmitAction}
          disabled={selectedTarget === 0 || isSubmitting}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
        >
          {isSubmitting ? '提交中...' : '确认'}
        </button>
      </div>
    );
  }

  // 守卫 - 守护阶段
  if (role === 'guard' && phase === 'guard') {
    const lastGuard = myPlayer.abilities.lastGuardTarget;
    const excludeTarget = lastGuard && lastGuard > 0 ? lastGuard : null;

    return (
      <div className="space-y-3">
        {excludeTarget && (
          <div className="text-yellow-300/70 text-xs">上晚守护 {excludeTarget}号（不可重复）</div>
        )}
        <div className="text-gray-400 text-xs">选择守护目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
          includeSelf
          excludeIds={excludeTarget ? [excludeTarget] : []}
        />
        <div className="flex gap-2">
          <button
            onClick={onSubmitAction}
            disabled={selectedTarget === 0 || isSubmitting}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
          >
            {isSubmitting ? '提交中...' : '确认'}
          </button>
          <button
            onClick={() => { setSelectedTarget(0); submitAction(game, myPlayer, 'skip', 0); }}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition"
          >
            空守
          </button>
        </div>
      </div>
    );
  }

  // 预言家 - 查验阶段
  if (role === 'seer' && phase === 'seer') {
    return (
      <div className="space-y-3">
        <div className="text-gray-400 text-xs">选择查验目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
        />
        <button
          onClick={onSubmitAction}
          disabled={selectedTarget === 0 || isSubmitting}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
        >
          {isSubmitting ? '提交中...' : '确认'}
        </button>
      </div>
    );
  }

  // 石像鬼 - 查验阶段
  if (role === 'gargoyle' && phase === 'gargoyle') {
    return (
      <div className="space-y-3">
        <div className="text-gray-400 text-xs">选择查验目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
        />
        <button
          onClick={onSubmitAction}
          disabled={selectedTarget === 0 || isSubmitting}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
        >
          {isSubmitting ? '提交中...' : '确认'}
        </button>
      </div>
    );
  }

  // 守墓人 - 验尸阶段
  if (role === 'gravekeeper' && phase === 'gravekeeper') {
    return (
      <div className="space-y-3">
        <div className="text-gray-500 text-xs">查看上轮被投票出局者的阵营</div>
        <button
          onClick={() => submitAction(game, myPlayer, 'check', 0)}
          disabled={isSubmitting}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition"
        >
          {isSubmitting ? '查询中...' : '确认验尸'}
        </button>
      </div>
    );
  }

  // 狼美人 - 魅惑阶段
  if (role === 'wolf_beauty' && phase === 'wolf_beauty') {
    return (
      <div className="space-y-3">
        <div className="text-gray-400 text-xs">选择魅惑目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={selectedTarget}
          onSelect={setSelectedTarget}
        />
        <div className="flex gap-2">
          <button
            onClick={onSubmitAction}
            disabled={selectedTarget === 0 || isSubmitting}
            className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
          >
            {isSubmitting ? '提交中...' : '确认'}
          </button>
          <button
            onClick={() => { setSelectedTarget(0); submitAction(game, myPlayer, 'skip', 0); }}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition"
          >
            跳过
          </button>
        </div>
      </div>
    );
  }

  // 女巫 - 用药阶段
  if (role === 'witch' && phase === 'witch') {
    return (
      <CompactWitchPanel
        myPlayer={myPlayer}
        game={game}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
      />
    );
  }

  // 狼人阶段
  if (myPlayer.camp === 'wolf' && phase === 'wolf') {
    return (
      <CompactWolfPanel
        myPlayer={myPlayer}
        game={game}
        wolfChatMessages={wolfChatMessages}
        selectedTarget={selectedTarget}
        setSelectedTarget={setSelectedTarget}
        onSubmitAction={onSubmitAction}
        isSubmitting={isSubmitting}
      />
    );
  }

  // 狼人自爆 - 讨论阶段
  const canBoom = myPlayer.camp === 'wolf' && role !== 'wolf_beauty' && role !== 'black_wolf' && role !== 'gargoyle' && role !== 'nightmare';
  if (canBoom && phase === 'discussion') {
    return (
      <div className="space-y-3">
        <div className="text-gray-500 text-xs">自爆后立即死亡，跳过白天进入黑夜</div>
        <div className="flex gap-2">
          <button
            onClick={() => submitAction(game, myPlayer, 'boom', 0)}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition"
          >
            确认自爆
          </button>
          <button
            onClick={() => submitAction(game, myPlayer, 'skip', 0)}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition"
          >
            不使用
          </button>
        </div>
      </div>
    );
  }

  // 非当前角色行动阶段 — 等待
  return (
    <div className="text-center py-6">
      <p className="text-gray-500 text-sm">等待当前阶段结束...</p>
    </div>
  );
}
