import { useState } from 'react';
import { GamePlayer, Game, NightSubPhase } from '../../../shared/src/types';
import { wsService } from '../services/websocket';
import { getRoleName, getPhaseLabel } from '../utils/phaseLabels';

// 所有夜间阶段
const NIGHT_PHASES: NightSubPhase[] = [
  'fear', 'dream', 'gargoyle', 'guard', 'wolf', 'wolf_beauty', 'witch', 'seer', 'gravekeeper', 'settle'
];

interface RoleActionPanelProps {
  myPlayer: GamePlayer;
  currentGame: Game;
  selectedTarget: number;
  setSelectedTarget: (v: number) => void;
  // 女巫专用
  witchAction: 'none' | 'antidote' | 'poison';
  setWitchAction: (v: 'none' | 'antidote' | 'poison') => void;
  showPoisonModal: boolean;
  setShowPoisonModal: (v: boolean) => void;
  poisonTarget: number;
  setPoisonTarget: (v: number) => void;
  onSubmitAction: () => void;
  onWitchSubmit: (action?: 'save' | 'poison' | 'none', target?: number) => void;
  isSubmitting?: boolean;
}

const PANEL_CLASS = "bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20";

/** 通用目标选择器 */
function TargetSelector({
  players,
  myPlayerId,
  value,
  onChange,
  label,
  borderColor = 'white/30',
  includeSelf = false,
}: {
  players: GamePlayer[];
  myPlayerId: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  borderColor?: string;
  includeSelf?: boolean;
}) {
  return (
    <div>
      <label className="block text-white text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full px-4 py-2 bg-gray-800 border border-${borderColor} rounded-lg text-white focus:border-blue-500 focus:outline-none`}
      >
        <option value={0} className="bg-gray-800 text-white">请选择目标...</option>
        {players
          .filter((p) => p.alive && (includeSelf || p.playerId !== myPlayerId))
          .map((player) => (
            <option key={player.playerId} value={player.playerId} className="bg-gray-800 text-white">
              {player.playerId}号 - {player.username}
            </option>
          ))}
      </select>
    </div>
  );
}

/** 提交+跳过按钮对 */
function ActionButtons({
  onSubmit,
  onSkip,
  submitLabel,
  skipLabel,
  submitDisabled = false,
  submitColor = 'purple',
  isLoading = false,
}: {
  onSubmit: () => void;
  onSkip?: () => void;
  submitLabel: string;
  skipLabel?: string;
  submitDisabled?: boolean;
  submitColor?: string;
  isLoading?: boolean;
}) {
  return (
    <div className={onSkip ? "flex gap-4" : ""}>
      <button
        onClick={onSubmit}
        disabled={submitDisabled || isLoading}
        className={`${onSkip ? 'flex-1' : 'w-full'} py-3 bg-${submitColor}-600 hover:bg-${submitColor}-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition`}
      >
        {isLoading ? '提交中...' : submitLabel}
      </button>
      {onSkip && skipLabel && (
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
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

/** 女巫操作面板 */
function WitchPanel({
  victim, hasAntidote, hasPoison, canSave, players, isSubmitting,
  showPoisonModal, setShowPoisonModal, onWitchSubmit,
}: {
  victim?: number;
  hasAntidote: boolean;
  hasPoison: boolean;
  canSave: boolean;
  players: GamePlayer[];
  isSubmitting: boolean;
  showPoisonModal: boolean;
  setShowPoisonModal: (v: boolean) => void;
  onWitchSubmit: (action?: 'save' | 'poison' | 'none', target?: number) => void;
}) {
  const [showAntidoteConfirm, setShowAntidoteConfirm] = useState(false);

  return (
    <div className={PANEL_CLASS}>
      <h3 className="text-xl font-bold text-white mb-4">女巫阶段</h3>

      {victim && (
        <div className="mb-6 p-4 bg-red-600/20 border border-red-500 rounded-lg">
          <p className="text-white font-bold">昨晚被刀: {victim}号</p>
        </div>
      )}

      <div className="mb-6 p-4 bg-white/5 rounded-lg">
        <div className="flex gap-4 text-sm">
          <div className={hasAntidote ? 'text-green-400' : 'text-gray-500'}>
            解药 {hasAntidote ? '✓ 可用' : '✗ 已使用'}
          </div>
          <div className={hasPoison ? 'text-red-400' : 'text-gray-500'}>
            毒药 {hasPoison ? '✓ 可用' : '✗ 已使用'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* 使用解药 */}
        <button
          onClick={() => setShowAntidoteConfirm(true)}
          disabled={!canSave || isSubmitting}
          className={`w-full py-3 rounded-lg font-bold transition ${
            canSave ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canSave ? `使用解药救 ${victim} 号` : hasAntidote ? '今晚无人被刀' : '解药已使用'}
        </button>

        {/* 使用毒药 */}
        <button
          onClick={() => setShowPoisonModal(true)}
          disabled={!hasPoison || isSubmitting}
          className={`w-full py-3 rounded-lg font-bold transition ${
            hasPoison ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
          }`}
        >
          {hasPoison ? '使用毒药' : '毒药已使用'}
        </button>

        {/* 什么都不用 */}
        <button
          onClick={() => onWitchSubmit('none')}
          disabled={isSubmitting}
          className="w-full py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
        >
          {isSubmitting ? '提交中...' : '什么都不用'}
        </button>
      </div>

      {/* 解药确认弹窗 */}
      {showAntidoteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-green-500 rounded-2xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">确认使用解药</h3>
            <p className="text-gray-300 mb-6">确认使用解药救 <span className="text-green-400 font-bold">{victim}号</span> ？</p>
            <div className="flex gap-4">
              <button
                onClick={() => { setShowAntidoteConfirm(false); onWitchSubmit('save'); }}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-lg transition"
              >确认</button>
              <button
                onClick={() => setShowAntidoteConfirm(false)}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
              >取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 毒药选人弹窗 */}
      {showPoisonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-red-500 rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">选择毒药目标</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {players.filter(p => p.alive).map(player => (
                <button
                  key={player.playerId}
                  onClick={() => { setShowPoisonModal(false); onWitchSubmit('poison', player.playerId); }}
                  disabled={isSubmitting}
                  className="py-3 bg-red-600/30 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-lg transition border border-red-500/50 hover:border-red-500"
                >
                  {player.playerId}号
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPoisonModal(false)}
              className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition"
            >取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoleActionPanel(props: RoleActionPanelProps) {
  const {
    myPlayer, currentGame, selectedTarget, setSelectedTarget,
    witchAction, setWitchAction, showPoisonModal, setShowPoisonModal,
    poisonTarget, setPoisonTarget, onSubmitAction, onWitchSubmit,
    isSubmitting = false,
  } = props;

  const phase = currentGame.currentPhase;
  const role = myPlayer.role;
  const isNight = NIGHT_PHASES.includes(phase as NightSubPhase);

  // 平民/无夜间行动角色在夜间显示等待
  if ((role === 'villager' || !myPlayer.abilities.hasNightAction) && isNight) {
    return (
      <div className={`${PANEL_CLASS} text-center`}>
        <h3 className="text-2xl font-bold text-white mb-4">🌙 夜晚阶段</h3>
        <p className="text-gray-300">天黑请闭眼,请等待其他角色行动...</p>
      </div>
    );
  }

  // 噩梦之影 - 恐惧阶段
  if (role === 'nightmare' && phase === 'fear') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">🌙 恐惧阶段 - 噩梦之影</h3>
        <p className="text-gray-300 mb-6">选择一名玩家，让其陷入恐惧无法使用技能，或者选择放弃此次行动。</p>
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择恐惧目标"
            borderColor="purple-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认恐惧"
            submitColor="purple"
            isLoading={isSubmitting}
            onSkip={() => {
              setSelectedTarget(0);
              submitAction(currentGame, myPlayer, 'skip', 0);
            }}
            skipLabel="放弃恐惧"
          />
        </div>
      </div>
    );
  }

  // 摄梦人 - 梦游阶段
  if (role === 'dreamer' && phase === 'dream') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">💤 梦游阶段 - 摄梦人</h3>
        <p className="text-gray-300 mb-6">选择一名玩家进行梦游。连续2晚梦游同一人会将其梦死,否则守护该玩家。</p>
        {myPlayer.abilities.lastDreamTarget && (
          <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded-lg">
            <p className="text-blue-300 text-sm">💤 上一晚梦游了 {myPlayer.abilities.lastDreamTarget}号</p>
          </div>
        )}
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择梦游目标"
            borderColor="blue-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认梦游"
            submitColor="blue"
            isLoading={isSubmitting}
          />
        </div>
      </div>
    );
  }

  // 守卫 - 守护阶段
  if (role === 'guard' && phase === 'guard') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">🛡️ 守护阶段 - 守卫</h3>
        <p className="text-gray-300 mb-6">选择一名玩家进行守护，使其今晚免受狼刀。不能连续两晚守护同一人。</p>
        {myPlayer.abilities.lastGuardTarget && (
          <div className="mb-4 p-3 bg-blue-600/20 border border-blue-500 rounded-lg">
            <p className="text-blue-300 text-sm">🛡️ 上一晚守护了 {myPlayer.abilities.lastGuardTarget}号（本晚不可再选）</p>
          </div>
        )}
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择守护目标"
            borderColor="blue-500/50"
            includeSelf={true}
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认守护"
            submitColor="blue"
            isLoading={isSubmitting}
            onSkip={() => {
              setSelectedTarget(0);
              submitAction(currentGame, myPlayer, 'skip', 0);
            }}
            skipLabel="放弃守护"
          />
        </div>
      </div>
    );
  }

  // 预言家 - 查验阶段
  if (role === 'seer' && phase === 'seer') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">🔮 查验阶段 - 预言家</h3>
        <p className="text-gray-300 mb-6">选择一名玩家查验其身份（好人/狼人）。</p>
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择查验目标"
            borderColor="cyan-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认查验"
            submitColor="blue"
            isLoading={isSubmitting}
          />
        </div>
      </div>
    );
  }

  // 石像鬼 - 查验阶段
  if (role === 'gargoyle' && phase === 'gargoyle') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">🗿 查验阶段 - 石像鬼</h3>
        <p className="text-gray-300 mb-6">选择一名玩家查验其具体角色。你是独狼，不参与狼人刀人。</p>
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择查验目标"
            borderColor="purple-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认查验"
            submitColor="purple"
            isLoading={isSubmitting}
          />
        </div>
      </div>
    );
  }

  // 守墓人 - 验尸阶段（自动获取上轮投票出局者的阵营）
  if (role === 'gravekeeper' && phase === 'gravekeeper') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">⚰️ 验尸阶段 - 守墓人</h3>
        <p className="text-gray-300 mb-6">
          自动获取上一轮被投票出局玩家的阵营（好人/坏人）。点击确认查看结果。
        </p>
        <button
          onClick={() => submitAction(currentGame, myPlayer, 'check', 0)}
          disabled={isSubmitting}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
        >
          {isSubmitting ? '查询中...' : '确认验尸'}
        </button>
      </div>
    );
  }

  // 狼美人 - 魅惑阶段
  if (role === 'wolf_beauty' && phase === 'wolf_beauty') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">💃 魅惑阶段 - 狼美人</h3>
        <p className="text-gray-300 mb-6">选择一名玩家进行魅惑连结。若你死亡，被魅惑者将一同出局。</p>
        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择魅惑目标"
            borderColor="pink-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认魅惑"
            submitColor="pink"
            isLoading={isSubmitting}
            onSkip={() => {
              setSelectedTarget(0);
              submitAction(currentGame, myPlayer, 'skip', 0);
            }}
            skipLabel="放弃魅惑"
          />
        </div>
      </div>
    );
  }

  // 女巫 - 用药阶段
  if (role === 'witch' && phase === 'witch') {
    const victim = currentGame.nightActions.witchKnowsVictim;
    const hasAntidote = !!myPlayer.abilities.antidote;
    const hasPoison = !!myPlayer.abilities.poison;
    const canSave = hasAntidote && !!victim;

    return (
      <WitchPanel
        victim={victim}
        hasAntidote={hasAntidote}
        hasPoison={hasPoison}
        canSave={canSave}
        players={currentGame.players}
        isSubmitting={isSubmitting}
        showPoisonModal={showPoisonModal}
        setShowPoisonModal={setShowPoisonModal}
        onWitchSubmit={onWitchSubmit}
      />
    );
  }

  // 狼人阶段 - 通用（wolf/white_wolf/black_wolf/nightmare 等狼人阵营刀人）
  if (myPlayer.camp === 'wolf' && phase === 'wolf') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">🐺 狼人刀人阶段</h3>

        <div className="mb-6 p-4 bg-red-600/20 border border-red-500 rounded-lg">
          <h4 className="text-white font-bold mb-3">🐺 狼人队友</h4>
          <div className="grid grid-cols-2 gap-2">
            {currentGame.players
              .filter((p) => p.camp === 'wolf' && p.alive)
              .map((wolf) => (
                <div
                  key={wolf.playerId}
                  className={`p-3 rounded-lg ${
                    wolf.playerId === myPlayer.playerId ? 'bg-red-700/50 border-2 border-red-400' : 'bg-red-600/30'
                  }`}
                >
                  <div className="text-white font-bold">
                    {wolf.playerId}号{wolf.playerId === myPlayer.playerId && ' (你)'}
                  </div>
                  <div className="text-gray-300 text-sm">{wolf.username}</div>
                </div>
              ))}
          </div>
        </div>

        <div className="space-y-4">
          <TargetSelector
            players={currentGame.players}
            myPlayerId={myPlayer.playerId}
            value={selectedTarget}
            onChange={setSelectedTarget}
            label="选择刀人目标"
            borderColor="red-500/50"
          />
          <ActionButtons
            onSubmit={onSubmitAction}
            submitDisabled={selectedTarget === 0}
            submitLabel="确认刀人"
            submitColor="red"
            isLoading={isSubmitting}
          />
        </div>
      </div>
    );
  }

  // 狼人阵营 - 讨论阶段自爆（狼美人和黑狼王不能自爆）
  const canBoom = myPlayer.camp === 'wolf' && role !== 'wolf_beauty' && role !== 'black_wolf' && role !== 'gargoyle' && role !== 'nightmare';
  if (canBoom && phase === 'discussion') {
    return (
      <div className={PANEL_CLASS}>
        <h3 className="text-xl font-bold text-white mb-4">狼人自爆</h3>
        <p className="text-gray-300 mb-4">
          自爆后你将立即死亡，跳过白天直接进入黑夜。
          {myPlayer.isSheriff ? '你是当前警长，自爆后警徽将由上帝指定传递。' : ''}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => submitAction(currentGame, myPlayer, 'boom', 0)}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
          >
            确认自爆
          </button>
          <button
            onClick={() => submitAction(currentGame, myPlayer, 'skip', 0)}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
          >
            不使用
          </button>
        </div>
      </div>
    );
  }

  // 通用 fallback — 用于所有未专门处理的角色/阶段组合
  return (
    <div className={PANEL_CLASS}>
      <h3 className="text-xl font-bold text-white mb-4">当前阶段: {getPhaseLabel(phase)}</h3>
      <div className="space-y-4">
        <TargetSelector
          players={currentGame.players}
          myPlayerId={myPlayer.playerId}
          value={selectedTarget}
          onChange={setSelectedTarget}
          label="选择目标"
        />
        <ActionButtons
          onSubmit={onSubmitAction}
          submitLabel="提交操作"
          submitColor="purple"
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
}
