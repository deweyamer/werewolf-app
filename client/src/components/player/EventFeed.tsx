import { useRef, useEffect } from 'react';
import { GameEvent } from '../../../../shared/src/types';

interface EventFeedProps {
  events: GameEvent[];
  className?: string;
}

export default function EventFeed({ events, className = '' }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 自动滚到底部
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-600 text-sm ${className}`}>
        等待游戏开始...
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-y-auto px-3 py-2 ${className}`}>
      <div className="space-y-0.5">
        {events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EventItem({ event }: { event: GameEvent }) {
  const typeColors: Record<string, string> = {
    death: 'text-red-400',
    vote_result: 'text-orange-300',
    sheriff: 'text-yellow-400',
    sheriff_transfer: 'text-yellow-300',
    game_end: 'text-green-400',
    boom: 'text-red-500',
    phase: 'text-gray-300',
    round_start: 'text-blue-300',
    night_action: 'text-purple-300',
    settlement: 'text-gray-400',
  };

  const textColor = typeColors[event.type] || 'text-gray-300';

  return (
    <div className="flex items-start gap-2 py-1 min-h-[24px]">
      <span className="text-gray-600 shrink-0 w-7 text-right text-xs font-mono leading-5">
        R{event.round}
      </span>
      <span className="shrink-0 w-5 text-center text-xs leading-5">{event.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-xs leading-5 ${textColor}`}>{event.text}</span>
        {event.details && (
          <div className="text-gray-500 text-xs leading-4 mt-0.5">{event.details}</div>
        )}
      </div>
    </div>
  );
}
