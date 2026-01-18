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
 * Smart shuffle - assigns questions avoiding repeats from previous round
 */
function assignQuestionsWithShuffle(players: Player[]): void {
    // Build a map of previous questions
    const previousAssignments = new Map<string, QuestionType>();
    players.forEach(p => {
        if (p.previousQuestion) {
            previousAssignments.set(p.id, p.previousQuestion);
        }
    });

    // Shuffle players
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const availableQuestions = [...QUESTIONS];

    // First pass: try to assign questions avoiding repeats
    const assignments = new Map<string, QuestionType>();
    const assignedQuestions = new Set<QuestionType>();

    // Try to assign each player a different question than their previous one
    for (const player of shuffledPlayers) {
        const prevQuestion = previousAssignments.get(player.id);

        // Find a question that's not their previous one and not already assigned
        let assigned = false;
        for (const question of availableQuestions) {
            if (!assignedQuestions.has(question) && question !== prevQuestion) {
                assignments.set(player.id, question);
                assignedQuestions.add(question);
                assigned = true;
                break;
            }
        }

        // If we couldn't avoid the previous question, just assign any available one
        if (!assigned) {
            for (const question of availableQuestions) {
                if (!assignedQuestions.has(question)) {
                    assignments.set(player.id, question);
                    assignedQuestions.add(question);
                    break;
                }
            }
        }

        // Stop if we've assigned all 4 questions
        if (assignedQuestions.size >= 4) break;
    }

    // Apply assignments to players
    for (const player of players) {
        const question = assignments.get(player.id);
        if (question) {
            player.previousQuestion = player.assignedQuestion; // Save current as previous
            player.assignedQuestion = question;
            player.hasAnswered = false;
        } else {
            // Player doesn't have a question this round (more than 4 players)
            player.previousQuestion = player.assignedQuestion;
            player.assignedQuestion = undefined;
            player.hasAnswered = false;
        }
    }
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

    // Use smart shuffle to assign questions
    assignQuestionsWithShuffle(room.players);

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
    const validation = validateAnswer(answer);
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

    // Use smart shuffle to reassign questions (avoids giving same question twice in a row)
    assignQuestionsWithShuffle(room.players);

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
