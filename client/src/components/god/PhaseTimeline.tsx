import { RoundHistoryEntry } from '../../../../shared/src/types';

export type TimelineSegment = { round: number; period: 'night' | 'day' };

interface PhaseTimelineProps {
  currentRound: number;
  currentPhaseType: 'night' | 'day' | 'transition';
  roundHistory: RoundHistoryEntry[];
  selectedSegment: TimelineSegment | null;
  onSelectSegment: (segment: TimelineSegment | null) => void;
}

export default function PhaseTimeline({
  currentRound,
  currentPhaseType,
  roundHistory,
  selectedSegment,
  onSelectSegment,
}: PhaseTimelineProps) {
  // Build timeline segments from round history + current
  const segments: (TimelineSegment & { label: string; isCurrent: boolean })[] = [];

  for (let r = 1; r <= currentRound; r++) {
    // Night segment for each round
    const isCurrentNight = r === currentRound && (currentPhaseType === 'night' || currentPhaseType === 'transition');
    segments.push({
      round: r,
      period: 'night',
      label: `第${r}晚`,
      isCurrent: isCurrentNight && r === currentRound,
    });

    // Day segment — only if we have history for it or we're currently in day
    const hasRoundHistory = roundHistory.some(h => h.round === r);
    const isCurrentDay = r === currentRound && currentPhaseType === 'day';

    if (hasRoundHistory || isCurrentDay || r < currentRound) {
      segments.push({
        round: r,
        period: 'day',
        label: `第${r}天`,
        isCurrent: isCurrentDay,
      });
    }
  }

  const isSelected = (seg: TimelineSegment) =>
    selectedSegment?.round === seg.round && selectedSegment?.period === seg.period;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {segments.map((seg, idx) => {
          const selected = isSelected(seg);
          const current = seg.isCurrent && !selectedSegment;
          const isNight = seg.period === 'night';

          return (
            <div key={`${seg.round}-${seg.period}`} className="flex items-center flex-shrink-0">
              {idx > 0 && (
                <div className="w-4 h-px bg-white/30 flex-shrink-0" />
              )}
              <button
                onClick={() => {
                  if (seg.isCurrent) {
                    onSelectSegment(null);
                  } else {
                    onSelectSegment({ round: seg.round, period: seg.period });
                  }
                }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                  ${selected
                    ? 'bg-white/30 text-white ring-2 ring-white/50'
                    : current
                      ? isNight
                        ? 'bg-indigo-600/50 text-indigo-200 ring-2 ring-indigo-400/50 animate-pulse'
                        : 'bg-amber-600/50 text-amber-200 ring-2 ring-amber-400/50 animate-pulse'
                      : isNight
                        ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40'
                        : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/40'
                  }
                `}
              >
                <span>{isNight ? '\u{1F319}' : '\u{2600}\u{FE0F}'}</span>
                <span>{seg.label}</span>
              </button>
            </div>
          );
        })}

        {/* "Current" button to return to live view */}
        {selectedSegment && (
          <div className="flex items-center flex-shrink-0">
            <div className="w-4 h-px bg-white/30 flex-shrink-0" />
            <button
              onClick={() => onSelectSegment(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-600/40 text-green-200 hover:bg-green-600/60 transition-all whitespace-nowrap ring-2 ring-green-400/50"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>返回当前</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
