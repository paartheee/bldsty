import { create } from 'zustand';
import type { Room, Player, QuestionType, GamePhase } from '@/types/game';

interface GameStore {
    // Connection state
    isConnected: boolean;
    setConnected: (connected: boolean) => void;

    // Player state
    playerId: string | null;
    playerName: string | null;
    setPlayer: (id: string, name: string) => void;

    // Room state
    room: Room | null;
    setRoom: (room: Room | null) => void;

    // Derived state
    getMyQuestion: () => QuestionType | null;

    // UI state
    isWaiting: boolean;
    setWaiting: (waiting: boolean) => void;

    error: string | null;
    setError: (error: string | null) => void;

    // Helpers
    isHost: () => boolean;
    getMyPlayer: () => Player | undefined;
    hasAnswered: () => boolean;

    // Reset
    reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
    // Initial state
    isConnected: false,
    playerId: null,
    playerName: null,
    room: null,
    isWaiting: false,
    error: null,

    // Actions
    setConnected: (connected) => set({ isConnected: connected }),
    setPlayer: (id, name) => set({ playerId: id, playerName: name }),
    setRoom: (room) => set({ room }),
    setWaiting: (waiting) => set({ isWaiting: waiting }),
    setError: (error) => set({ error }),

    // Helpers
    getMyQuestion: () => {
        const { room, playerId } = get();
        const player = room?.players.find(p => p.id === playerId);
        return player?.assignedQuestion || null;
    },

    isHost: () => {
        const { room, playerId } = get();
        return room?.hostId === playerId;
    },

    getMyPlayer: () => {
        const { room, playerId } = get();
        return room?.players.find(p => p.id === playerId);
    },

    hasAnswered: () => {
        const player = get().getMyPlayer();
        return player?.hasAnswered || false;
    },

    reset: () => set({
        playerId: null,
        playerName: null,
        room: null,
        isWaiting: false,
        error: null
    })
}));
