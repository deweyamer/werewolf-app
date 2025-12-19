import { create } from 'zustand';
import { Game } from '../../../shared/src/types';

interface GameState {
  currentGame: Game | null;
  setGame: (game: Game) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  setGame: (game) => set({ currentGame: game }),
  clearGame: () => set({ currentGame: null }),
}));
