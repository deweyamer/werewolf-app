import { useState } from 'react';
import { Game, GamePlayer } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';
import { useInlineConfirm } from '../../hooks/useInlineConfirm';
import TargetGrid from './TargetGrid';

interface CompactWitchPanelProps {
  myPlayer: GamePlayer;
  game: Game;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

export default function CompactWitchPanel({ myPlayer, game, isSubmitting, setIsSubmitting }: CompactWitchPanelProps) {
  const [showPoisonGrid, setShowPoisonGrid] = useState(false);
  const [poisonTarget, setPoisonTarget] = useState(0);

  const victim = game.nightActions.witchKnowsVictim;
  const hasAntidote = !!myPlayer.abilities.antidote;
  const hasPoison = !!myPlayer.abilities.poison;
  const canSave = hasAntidote && !!victim;

  const submit = (actionType: 'save' | 'poison' | 'none', target?: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    wsService.send({
      type: 'PLAYER_SUBMIT_ACTION',
      action: {
        phase: game.currentPhase,
        playerId: myPlayer.playerId,
        actionType,
        target: target || (actionType === 'save' ? (victim || 0) : 0),
      },
    });
  };

  const saveConfirm = useInlineConfirm(() => submit('save'));

  // 毒药模式：显示目标网格
  if (showPoisonGrid) {
    return (
      <div className="space-y-3">
        <div className="text-gray-400 text-xs">选择毒药目标</div>
        <TargetGrid
          players={game.players}
          myPlayerId={myPlayer.playerId}
          selected={poisonTarget}
          onSelect={setPoisonTarget}
        />
        <div className="flex gap-2">
          <button
            onClick={() => { if (poisonTarget > 0) submit('poison', poisonTarget); }}
            disabled={poisonTarget === 0 || isSubmitting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
          >
            {isSubmitting ? '提交中...' : '确认'}
          </button>
          <button
            onClick={() => { setShowPoisonGrid(false); setPoisonTarget(0); }}
            className="px-4 py-2.5 bg-gray-700 text-gray-300 text-sm rounded-lg transition hover:bg-gray-600"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 被害人信息 */}
      {victim ? (
        <div className="text-red-400 text-sm">昨晚 {victim}号被刀</div>
      ) : (
        <div className="text-gray-500 text-sm">昨晚无人被刀</div>
      )}

      {/* 药水状态指示 */}
      <div className="flex gap-3 text-xs">
        <span className={hasAntidote ? 'text-green-400' : 'text-gray-600'}>● 解药{hasAntidote ? '' : '(已用)'}</span>
        <span className={hasPoison ? 'text-red-400' : 'text-gray-600'}>● 毒药{hasPoison ? '' : '(已用)'}</span>
      </div>

      {/* 三个操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={() => { if (canSave) saveConfirm.handleClick(); }}
          disabled={!canSave || isSubmitting}
          className={`flex-1 py-3 rounded-lg text-sm font-bold transition ${
            saveConfirm.confirming
              ? 'bg-green-500 text-white ring-2 ring-green-300 animate-pulse'
              : canSave ? 'bg-green-600/80 hover:bg-green-600 text-white' : 'bg-gray-800 text-gray-600'
          }`}
        >
          {saveConfirm.confirming ? `救 ${victim}号？` : '💊 救'}
        </button>
        <button
          onClick={() => setShowPoisonGrid(true)}
          disabled={!hasPoison || isSubmitting}
          className={`flex-1 py-3 rounded-lg text-sm font-bold transition ${
            hasPoison ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-gray-800 text-gray-600'
          }`}
        >
          ☠ 毒
        </button>
        <button
          onClick={() => submit('none')}
          disabled={isSubmitting}
          className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm font-bold rounded-lg transition"
        >
          {isSubmitting ? '...' : '✋ 过'}
        </button>
      </div>
    </div>
  );
}
