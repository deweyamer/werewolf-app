import { create } from 'zustand';
import { Game, GameEvent } from '../../../shared/src/types';

const MAX_EVENTS = 100;

interface GameState {
  currentGame: Game | null;
  eventLog: GameEvent[];
  setGame: (game: Game) => void;
  addEvent: (event: GameEvent) => void;
  addEvents: (events: GameEvent[]) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  eventLog: [],
  setGame: (game) => set({ currentGame: game }),
  addEvent: (event) => set((state) => {
    // 按 id 去重
    if (state.eventLog.some(e => e.id === event.id)) return state;
    const log = [...state.eventLog, event];
    return { eventLog: log.length > MAX_EVENTS ? log.slice(-MAX_EVENTS) : log };
  }),
  addEvents: (events) => set((state) => {
    const existingIds = new Set(state.eventLog.map(e => e.id));
    const newEvents = events.filter(e => !existingIds.has(e.id));
    if (newEvents.length === 0) return state;
    const log = [...state.eventLog, ...newEvents];
    return { eventLog: log.length > MAX_EVENTS ? log.slice(-MAX_EVENTS) : log };
  }),
  clearGame: () => set({ currentGame: null, eventLog: [] }),
}));
