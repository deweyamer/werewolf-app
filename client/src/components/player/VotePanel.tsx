import { useState, useEffect, useRef } from 'react';
import { Game, GamePlayer } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';
import TargetGrid from './TargetGrid';

interface VotePanelProps {
  game: Game;
  myPlayer: GamePlayer;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

/** 内联确认状态：null=初始, string=正在确认的key */
function useInlineConfirmState(timeout = 3000) {
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const requestConfirm = (key: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirmingKey(key);
    timerRef.current = setTimeout(() => setConfirmingKey(null), timeout);
  };

  const reset = () => {
    setConfirmingKey(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { confirmingKey, requestConfirm, reset };
}

export default function VotePanel({ game, myPlayer, isSubmitting, setIsSubmitting }: VotePanelProps) {
  const [selected, setSelected] = useState<number>(0);
  const { confirmingKey, requestConfirm, reset: resetConfirm } = useInlineConfirmState();

  // 警长竞选 - 上警阶段
  if (game.sheriffElection?.phase === 'signup') {
    const decided = myPlayer.sheriffCandidate !== undefined;
    return (
      <div className="space-y-3">
        <div className="text-yellow-400 text-sm font-bold">★ 警长竞选</div>
        {decided ? (
          <div className="text-green-400 text-sm text-center py-2">
            ✓ {myPlayer.sheriffCandidate ? '已上警' : '不上警'}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => wsService.send({ type: 'SHERIFF_SIGNUP', runForSheriff: true })}
              className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded-lg transition"
            >
              上警
            </button>
            <button
              onClick={() => wsService.send({ type: 'SHERIFF_SIGNUP', runForSheriff: false })}
              className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold rounded-lg transition"
            >
              不上警
            </button>
          </div>
        )}
      </div>
    );
  }

  // 警长竞选 - 竞选发言
  if (game.sheriffElection?.phase === 'campaign') {
    const iAmCandidate = game.sheriffElection.candidates.includes(myPlayer.playerId);
    return (
      <div className="space-y-3">
        <div className="text-yellow-400 text-sm font-bold">★ 竞选发言</div>
        <div className="flex flex-wrap gap-1.5">
          {game.sheriffElection.candidates.map(id => (
            <span key={id} className={`px-2 py-1 rounded text-xs font-bold ${
              id === myPlayer.playerId ? 'bg-yellow-600/40 text-yellow-200' : 'bg-yellow-600/20 text-yellow-300'
            }`}>
              {id}号
            </span>
          ))}
        </div>
        {iAmCandidate && (
          <button
            onClick={() => {
              if (confirmingKey === 'withdraw') {
                resetConfirm();
                wsService.send({ type: 'SHERIFF_WITHDRAW' });
              } else {
                requestConfirm('withdraw');
              }
            }}
            className={`w-full py-2 text-sm rounded-lg transition font-bold ${
              confirmingKey === 'withdraw'
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-gray-700 hover:bg-gray-600 text-red-400'
            }`}
          >
            {confirmingKey === 'withdraw' ? '确定退水？再点一次' : '退水'}
          </button>
        )}
      </div>
    );
  }

  // 警长竞选 - 投票
  if (game.sheriffElection?.phase === 'voting') {
    const election = game.sheriffElection;
    const iAmCandidate = election.candidates.includes(myPlayer.playerId);
    const iAmWithdrawn = election.withdrawn.includes(myPlayer.playerId);
    const hasVoted = election.votes[myPlayer.playerId] !== undefined;

    if (iAmCandidate || iAmWithdrawn) {
      return (
        <div className="space-y-3">
          <div className="text-yellow-400 text-sm font-bold">★ 警长投票</div>
          <div className="text-gray-400 text-sm text-center py-2">
            {iAmCandidate ? '你是候选人，不能投票' : '你已退水，不能投票'}
          </div>
        </div>
      );
    }

    if (hasVoted) {
      return (
        <div className="space-y-3">
          <div className="text-yellow-400 text-sm font-bold">★ 警长投票</div>
          <div className="text-green-400 text-sm text-center py-2">✓ 已投票</div>
          <div className="text-gray-500 text-xs text-center">
            {Object.keys(election.votes).length} / {game.players.filter(p => p.alive && !election.candidates.includes(p.playerId) && !election.withdrawn.includes(p.playerId)).length} 人已投
          </div>
        </div>
      );
    }

    // 候选人列表作为 target
    const candidatePlayers = election.candidates.map(id =>
      game.players.find(p => p.playerId === id)
    ).filter(Boolean) as GamePlayer[];

    return (
      <div className="space-y-3">
        <div className="text-yellow-400 text-sm font-bold">★ 选择警长</div>
        <div className="grid grid-cols-4 gap-2">
          {candidatePlayers.map(p => (
            <button
              key={p.playerId}
              onClick={() => setSelected(p.playerId === selected ? 0 : p.playerId)}
              className={`h-12 rounded-lg text-sm font-bold transition ${
                selected === p.playerId
                  ? 'bg-yellow-600 text-white ring-2 ring-yellow-400'
                  : 'bg-white/10 text-gray-300 active:bg-white/20'
              }`}
            >
              {p.playerId}
            </button>
          ))}
          <button
            onClick={() => setSelected(selected === -1 ? 0 : -1)}
            className={`h-12 rounded-lg text-xs font-bold transition ${
              selected === -1
                ? 'bg-gray-600 text-white ring-2 ring-gray-400'
                : 'bg-white/5 text-gray-500 active:bg-white/10'
            }`}
          >
            弃票
          </button>
        </div>
        <button
          onClick={() => {
            if (selected === 0) return;
            if (confirmingKey === 'sheriff-vote') {
              resetConfirm();
              const target = selected === -1 ? 'skip' : selected;
              setIsSubmitting(true);
              wsService.send({ type: 'SHERIFF_VOTE', candidateId: target });
              setSelected(0);
            } else {
              requestConfirm('sheriff-vote');
            }
          }}
          disabled={selected === 0 || isSubmitting}
          className={`w-full py-2.5 text-white text-sm font-bold rounded-lg transition ${
            confirmingKey === 'sheriff-vote'
              ? 'bg-yellow-500 ring-2 ring-yellow-300 animate-pulse'
              : 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500'
          }`}
        >
          {isSubmitting ? '提交中...' : confirmingKey === 'sheriff-vote'
            ? `确认投${selected === -1 ? '弃票' : ` ${selected}号`}？再点一次`
            : '确认投票'}
        </button>
      </div>
    );
  }

  // 警长竞选结果已通过 EventFeed 展示，不在 VotePanel 中重复显示

  // 放逐投票
  if (game.exileVote?.phase === 'voting') {
    const hasVoted = game.exileVote.votes[myPlayer.playerId] !== undefined;

    if (hasVoted) {
      return (
        <div className="space-y-3">
          <div className="text-red-400 text-sm font-bold">⚖ 放逐投票</div>
          <div className="text-green-400 text-sm text-center py-2">✓ 已投票</div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-red-400 text-sm font-bold">⚖ 放逐投票</div>
        <div className="grid grid-cols-4 gap-2">
          {game.players.filter(p => p.alive).map(p => (
            <button
              key={p.playerId}
              onClick={() => setSelected(p.playerId === selected ? 0 : p.playerId)}
              className={`h-12 rounded-lg text-sm font-bold transition ${
                selected === p.playerId
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-white/10 text-gray-300 active:bg-white/20'
              }`}
            >
              {p.playerId}
            </button>
          ))}
          <button
            onClick={() => setSelected(selected === -1 ? 0 : -1)}
            className={`h-12 rounded-lg text-xs font-bold transition ${
              selected === -1
                ? 'bg-gray-600 text-white ring-2 ring-gray-400'
                : 'bg-white/5 text-gray-500 active:bg-white/10'
            }`}
          >
            弃票
          </button>
        </div>
        <button
          onClick={() => {
            if (selected === 0) return;
            if (confirmingKey === 'exile-vote') {
              resetConfirm();
              const target = selected === -1 ? 'skip' : selected;
              setIsSubmitting(true);
              wsService.send({ type: 'EXILE_VOTE', targetId: target });
              setSelected(0);
            } else {
              requestConfirm('exile-vote');
            }
          }}
          disabled={selected === 0 || isSubmitting}
          className={`w-full py-2.5 text-white text-sm font-bold rounded-lg transition ${
            confirmingKey === 'exile-vote'
              ? 'bg-red-500 ring-2 ring-red-300 animate-pulse'
              : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500'
          }`}
        >
          {isSubmitting ? '提交中...' : confirmingKey === 'exile-vote'
            ? `确认放逐${selected === -1 ? '弃票' : ` ${selected}号`}？再点一次`
            : '确认投票'}
        </button>
      </div>
    );
  }

  // 平票PK
  if (game.exileVote?.phase === 'pk' && game.exileVote.pkPlayers) {
    const pkPlayers = game.exileVote.pkPlayers;
    const iAmInPK = pkPlayers.includes(myPlayer.playerId);
    const hasVoted = game.exileVote.pkVotes?.[myPlayer.playerId] !== undefined;

    if (iAmInPK) {
      return (
        <div className="space-y-3">
          <div className="text-red-400 text-sm font-bold">⚖ PK投票</div>
          <div className="text-gray-400 text-sm text-center py-2">你在PK中，不能投票</div>
        </div>
      );
    }

    if (hasVoted) {
      return (
        <div className="space-y-3">
          <div className="text-red-400 text-sm font-bold">⚖ PK投票</div>
          <div className="text-green-400 text-sm text-center py-2">✓ 已投票</div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-red-400 text-sm font-bold">⚖ 平票PK</div>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {pkPlayers.map(id => (
            <span key={id} className="px-2 py-1 bg-red-600/20 text-red-300 rounded text-xs font-bold">
              {id}号
            </span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {pkPlayers.map(id => {
            const p = game.players.find(pl => pl.playerId === id);
            return (
              <button
                key={id}
                onClick={() => setSelected(id === selected ? 0 : id)}
                className={`h-12 rounded-lg text-sm font-bold transition ${
                  selected === id
                    ? 'bg-red-600 text-white ring-2 ring-red-400'
                    : 'bg-white/10 text-gray-300 active:bg-white/20'
                }`}
              >
                {id}
              </button>
            );
          })}
          <button
            onClick={() => setSelected(selected === -1 ? 0 : -1)}
            className={`h-12 rounded-lg text-xs font-bold transition ${
              selected === -1
                ? 'bg-gray-600 text-white ring-2 ring-gray-400'
                : 'bg-white/5 text-gray-500 active:bg-white/10'
            }`}
          >
            弃票
          </button>
        </div>
        <button
          onClick={() => {
            if (selected === 0) return;
            if (confirmingKey === 'pk-vote') {
              resetConfirm();
              const target = selected === -1 ? 'skip' : selected;
              setIsSubmitting(true);
              wsService.send({ type: 'EXILE_PK_VOTE', targetId: target });
              setSelected(0);
            } else {
              requestConfirm('pk-vote');
            }
          }}
          disabled={selected === 0 || isSubmitting}
          className={`w-full py-2.5 text-white text-sm font-bold rounded-lg transition ${
            confirmingKey === 'pk-vote'
              ? 'bg-red-500 ring-2 ring-red-300 animate-pulse'
              : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500'
          }`}
        >
          {isSubmitting ? '提交中...' : confirmingKey === 'pk-vote'
            ? `确认放逐${selected === -1 ? '弃票' : ` ${selected}号`}？再点一次`
            : '确认投票'}
        </button>
      </div>
    );
  }

  // 放逐投票 - 结果
  if (game.exileVote?.phase === 'done') {
    return (
      <div className="space-y-2">
        <div className="text-red-400 text-sm font-bold">⚖ 投票结果</div>
        {game.exileVote.result === 'none' ? (
          <div className="text-gray-400 text-sm text-center">无人被放逐</div>
        ) : typeof game.exileVote.result === 'number' ? (
          <div className="text-red-400 text-sm text-center">
            {game.exileVote.result}号 被放逐出局
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
