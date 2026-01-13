import type { Room, Player, QuestionType, RoomSettings, RevealData } from '@/types/game';
import { saveRoom, getRoom, roomExists } from './redis-client';
import { generateRoomCode } from './room-code-generator';
import { validateAnswer } from './profanity-filter';

const QUESTIONS: QuestionType[] = ['who', 'withWhom', 'where', 'how'];

/**
 * Create a new game room
 */
export async function createRoom(
    hostId: string,
    hostName: string,
    settings: RoomSettings
): Promise<Room> {
    let roomCode: string;

    // Ensure unique room code
    do {
        roomCode = generateRoomCode();
    } while (await roomExists(roomCode));

    const host: Player = {
        id: hostId,
        name: hostName,
        isHost: true,
        isReady: false
    };

    const room: Room = {
        code: roomCode,
        hostId,
        players: [host],
        settings,
        gameState: {
            phase: 'lobby',
            currentRound: 0,
            answers: {},
            currentTurnIndex: 0,
            questionOrder: []
        },
        createdAt: Date.now()
    };

    await saveRoom(room);
    return room;
}

/**
 * Add a player to a room
 */
export async function joinRoom(
    roomCode: string,
    playerId: string,
    playerName: string
): Promise<{ success: boolean; room?: Room; error?: string }> {
    const room = await getRoom(roomCode);

    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    if (room.gameState.phase !== 'lobby') {
        return { success: false, error: 'Game already in progress' };
    }

    if (room.players.length >= room.settings.maxPlayers) {
        return { success: false, error: 'Room is full' };
    }

    // Check for duplicate names
    if (room.players.some(p => p.name === playerName)) {
        return { success: false, error: 'Name already taken' };
    }

    const newPlayer: Player = {
        id: playerId,
        name: playerName,
        isHost: false,
        isReady: false
    };

    room.players.push(newPlayer);
    await saveRoom(room);

    return { success: true, room };
}

/**
 * Remove a player from a room
 */
export async function removePlayer(
    roomCode: string,
    playerId: string
): Promise<Room | null> {
    const room = await getRoom(roomCode);
    if (!room) return null;

    room.players = room.players.filter(p => p.id !== playerId);

    // If host left, assign new host or delete room
    if (playerId === room.hostId) {
        if (room.players.length > 0) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
        } else {
            // Room is empty, can be deleted
            return null;
        }
    }

    await saveRoom(room);
    return room;
}

/**
 * Start the game - assign questions to players
 */
export async function startGame(roomCode: string): Promise<Room | null> {
    const room = await getRoom(roomCode);
    if (!room || room.gameState.phase !== 'lobby') return null;

    if (room.players.length < 4) {
        throw new Error('Need at least 4 players to start');
    }

    // Shuffle players and assign questions
    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);

    QUESTIONS.forEach((question, index) => {
        const player = shuffledPlayers[index % shuffledPlayers.length];
        player.assignedQuestion = question;
        player.hasAnswered = false;
    });

    room.gameState.phase = 'playing';
    room.gameState.currentRound++;
    room.gameState.currentTurnIndex = 0;
    room.gameState.answers = {};
    room.gameState.questionOrder = QUESTIONS;

    await saveRoom(room);
    return room;
}

/**
 * Submit an answer for the current question
 */
export async function submitAnswer(
    roomCode: string,
    playerId: string,
    answer: string
): Promise<{ success: boolean; room?: Room; error?: string; shouldReveal?: boolean }> {
    const room = await getRoom(roomCode);
    if (!room || room.gameState.phase !== 'playing') {
        return { success: false, error: 'Invalid game state' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.assignedQuestion) {
        return { success: false, error: 'Player not found or no question assigned' };
    }

    if (player.hasAnswered) {
        return { success: false, error: 'Already answered' };
    }

    // Validate answer
    const validation = validateAnswer(answer, room.settings.moderationEnabled);
    if (!validation.isValid) {
        return { success: false, error: validation.error };
    }

    // Store answer
    room.gameState.answers[player.assignedQuestion] = {
        playerId: player.id,
        answer: validation.cleanedText
    };
    player.hasAnswered = true;

    // Check if all answers are in
    const allAnswered = QUESTIONS.every(q => room.gameState.answers[q]);

    if (allAnswered) {
        room.gameState.phase = 'reveal';
    }

    await saveRoom(room);
    return { success: true, room, shouldReveal: allAnswered };
}

/**
 * Generate reveal data from answers
 */
export function generateReveal(room: Room): RevealData | null {
    const { answers } = room.gameState;

    if (!answers.who || !answers.withWhom || !answers.where || !answers.how) {
        return null;
    }

    const who = answers.who.answer;
    const withWhom = answers.withWhom.answer;
    const where = answers.where.answer;
    const how = answers.how.answer;

    const sentence = `${who} was with ${withWhom} at ${where}, and they did it ${how}.`;

    return { who, withWhom, where, how, sentence };
}

/**
 * Start a new round
 */
export async function startNewRound(roomCode: string): Promise<Room | null> {
    const room = await getRoom(roomCode);
    if (!room || room.gameState.phase !== 'reveal') return null;

    // Shuffle and reassign questions
    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);

    QUESTIONS.forEach((question, index) => {
        const player = shuffledPlayers[index % shuffledPlayers.length];
        player.assignedQuestion = question;
        player.hasAnswered = false;
    });

    room.gameState.phase = 'playing';
    room.gameState.currentRound++;
    room.gameState.currentTurnIndex = 0;
    room.gameState.answers = {};

    await saveRoom(room);
    return room;
}

/**
 * Get question label for display
 */
export function getQuestionLabel(question: QuestionType): string {
    const labels: Record<QuestionType, string> = {
        who: 'Who?',
        withWhom: 'With whom?',
        where: 'Where?',
        how: 'How?'
    };
    return labels[question];
}
