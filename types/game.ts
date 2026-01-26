export type QuestionType = 'who' | 'withWhom' | 'where' | 'how';

export type GamePhase = 'lobby' | 'playing' | 'reveal';

export interface Player {
    id: string;
    name: string;
    isHost: boolean;
    isReady: boolean;
    assignedQuestion?: QuestionType;
    hasAnswered?: boolean;
    previousQuestion?: QuestionType; // Track previous question to prevent repeats
}

export interface RoomSettings {
    maxPlayers: number;
    language: string;
    timerSeconds: number; // Time allowed per answer (30, 60, 90, 120)
}

export interface GameState {
    phase: GamePhase;
    currentRound: number;
    answers: Partial<Record<QuestionType, { playerId: string; answer: string }>>;
    currentTurnIndex: number;
    questionOrder: QuestionType[];
    rotationIndex: number; // Tracks which group of 4 players should answer (for rotation)
}

export interface Room {
    code: string;
    hostId: string;
    players: Player[];
    settings: RoomSettings;
    gameState: GameState;
    createdAt: number;
}

export interface RevealData {
    who: string;
    withWhom: string;
    where: string;
    how: string;
    sentence: string;
}

// Socket.IO event types
export interface ServerToClientEvents {
    'room-updated': (room: Room) => void;
    'game-started': (room: Room) => void;
    'your-turn': (question: QuestionType) => void;
    'waiting-for-others': () => void;
    'reveal': (data: RevealData) => void;
    'player-joined': (player: Player) => void;
    'player-left': (playerId: string) => void;
    'error': (message: string) => void;
    'kicked': () => void;
    'game-reset': () => void;
}

export interface ClientToServerEvents {
    'create-room': (playerName: string, settings: RoomSettings, callback: (roomCode: string, room?: Room) => void) => void;
    'join-room': (roomCode: string, playerName: string, callback: (success: boolean, error?: string) => void) => void;
    'leave-room': () => void;
    'rejoin-room': (roomCode: string, playerId: string, playerName: string, callback: (success: boolean, room?: Room, error?: string) => void) => void;
    'start-game': () => void;
    'submit-answer': (answer: string) => void;
    'new-round': () => void;
    'kick-player': (playerId: string) => void;
    'toggle-ready': () => void;
    'reset-to-lobby': (newSettings?: Partial<RoomSettings>) => void; // Host resets game to lobby with optional new settings
}
