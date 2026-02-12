import { useState, useEffect, useRef, useMemo } from 'react';
import type { Game } from '../../../../shared/src/types';
import { useGameStore } from '../../stores/gameStore';
import { deriveGodEventsFromRoundHistory, deriveGodEventsFromNightActions } from '../../utils/eventFeedUtils';
import {
  EventCard, SectionHeader, NightActionProgressCard, DeadPlayerPhaseCard, DeathTriggerCard,
  SheriffAssignCard, SheriffElectionLiveCard, ExileVoteLiveCard,
  DiscussionCard, GameFinishedCard,
} from './EventFeedCards';

const NIGHT_PHASES = ['fear', 'dream', 'gargoyle', 'guard', 'wolf', 'wolf_beauty', 'witch', 'seer', 'gravekeeper', 'settle'];
const SHERIFF_PHASES = ['sheriffElection', 'sheriffCampaign', 'sheriffVote'];

export default function EventFeedPanel({ game }: { game: Game }) {
  // State: which round tab is selected ('current' or a round number)
  const [selectedRound, setSelectedRound] = useState<number | 'current'>('current');
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventLog = useGameStore(s => s.eventLog);

  // Auto-scroll to bottom when on "current" tab and new events arrive
  // Track previous event count to only scroll on new events
  const prevEventCountRef = useRef(0);
  useEffect(() => {
    if (selectedRound === 'current' && scrollRef.current) {
      const currentCount = eventLog.length;
      if (currentCount > prevEventCountRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      prevEventCountRef.current = currentCount;
    }
  }, [eventLog.length, selectedRound]);

  // Round tab array: completed rounds only (exclude current round to avoid overlap with "当前" tab)
  const completedRounds = (game.roundHistory || []).map(r => r.round).sort((a, b) => a - b);

  // Historical round events (memoized)
  const historicalEvents = useMemo(() => {
    if (selectedRound === 'current') return [];
    const entry = (game.roundHistory || []).find(r => r.round === selectedRound);
    if (!entry) return [];
    return deriveGodEventsFromRoundHistory(entry, game.players);
  }, [selectedRound, game.roundHistory, game.players]);

  // Current round events from eventLog (filtered by current round)
  const currentRoundEvents = useMemo(() => {
    if (selectedRound !== 'current') return [];
    return eventLog.filter(e => e.round === game.currentRound);
  }, [selectedRound, eventLog, game.currentRound]);

  // Current round night action events (live from game.nightActions)
  const currentNightEvents = useMemo(() => {
    if (selectedRound !== 'current') return [];
    return deriveGodEventsFromNightActions(game.nightActions, game.currentRound, game.players);
  }, [selectedRound, game.nightActions, game.currentRound, game.players]);

  const phase = game.currentPhase;
  const isNight = NIGHT_PHASES.includes(phase);
  const isSheriff = SHERIFF_PHASES.includes(phase);
  const unresolvedTriggers = (game.pendingDeathTriggers || []).filter(t => !t.resolved);

  return (
    <div className="flex flex-col h-full">
      {/* Round Tabs */}
      <div className="shrink-0 flex gap-1 px-2 py-1.5 border-b border-white/5 overflow-x-auto">
        {completedRounds.map(round => (
          <button key={round}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition whitespace-nowrap ${
              selectedRound === round ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
            }`}
            onClick={() => setSelectedRound(round)}
          >
            第{round}天
          </button>
        ))}
        <button
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition whitespace-nowrap ${
            selectedRound === 'current' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
          }`}
          onClick={() => setSelectedRound('current')}
        >
          当前
        </button>
      </div>

      {/* Scrollable Event Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* === HISTORICAL ROUND VIEW === */}
        {selectedRound !== 'current' && (
          <div className="py-2 space-y-0.5">
            {historicalEvents.length > 0 ? (
              historicalEvents.map(event => {
                if (event.type === 'round_start') return <SectionHeader key={event.id} icon="🌅" label={event.text} className="text-blue-300" />;
                if (event.type === 'settlement') return <SectionHeader key={event.id} icon="📋" label={event.text} className="text-yellow-300" />;
                return <EventCard key={event.id} event={event} />;
              })
            ) : (
              <div className="text-center text-gray-600 text-xs py-8">该回合暂无历史数据</div>
            )}
          </div>
        )}

        {/* === CURRENT ROUND VIEW === */}
        {selectedRound === 'current' && (
          <div className="py-2 space-y-1">
            {/* Round header */}
            {game.currentRound > 0 && (
              <SectionHeader icon="🌅" label={`第${game.currentRound}天`} className="text-blue-300" />
            )}

            {/* Night section */}
            {(isNight || currentNightEvents.length > 0) && (
              <>
                <SectionHeader icon="🌙" label="夜晚" className="text-indigo-300" />
                {currentNightEvents.map(event => <EventCard key={event.id} event={event} />)}
                {isNight && <div className="py-1"><NightActionProgressCard game={game} /></div>}
              </>
            )}

            {/* Settlement/death/boom events from eventLog */}
            {currentRoundEvents.filter(e => e.type === 'death' || e.type === 'settlement' || e.type === 'boom').map(event => (
              <EventCard key={event.id} event={event} />
            ))}

            {/* Day section */}
            {game.currentPhaseType === 'day' && (
              <>
                <SectionHeader icon="☀️" label="白天" className="text-amber-300" />
                {currentRoundEvents.filter(e => e.type === 'sheriff').map(event => <EventCard key={event.id} event={event} />)}
                {currentRoundEvents.filter(e => e.type === 'vote_result').map(event => <EventCard key={event.id} event={event} />)}
                {currentRoundEvents.filter(e => e.type === 'sheriff_transfer').map(event => <EventCard key={event.id} event={event} />)}
              </>
            )}

            {/* Game end events */}
            {currentRoundEvents.filter(e => e.type === 'game_end').map(event => <EventCard key={event.id} event={event} />)}

            {/* === ACTIVE OPERATION CARDS === */}
            <div className="space-y-2 pb-2">
              {game.currentPhaseDeadPlayer && isNight && <DeadPlayerPhaseCard game={game} />}
              {isSheriff && game.sheriffElection && <SheriffElectionLiveCard game={game} />}
              {!isSheriff && game.sheriffElection && (game.sheriffElection.phase === 'done' || game.sheriffElection.phase === 'tie') && <SheriffElectionLiveCard game={game} />}
              {phase === 'discussion' && <DiscussionCard game={game} />}
              {(phase === 'vote' || phase === 'voteResult') && game.exileVote && <ExileVoteLiveCard game={game} />}
              {game.pendingSheriffTransfer && <SheriffAssignCard transfer={game.pendingSheriffTransfer} game={game} />}
              {unresolvedTriggers.map(trigger => <DeathTriggerCard key={trigger.id} trigger={trigger} game={game} />)}
              {phase === 'finished' && <GameFinishedCard game={game} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
