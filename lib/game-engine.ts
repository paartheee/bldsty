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
            questionOrder: [],
            rotationIndex: 0
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
 * Rotational question assignment - assigns questions to groups of 4 players in rotation
 * With 8 players: Round 1 = players 0-3, Round 2 = players 4-7, Round 3 = players 0-3, etc.
 */
function assignQuestionsWithRotation(players: Player[], rotationIndex: number): void {
    const totalPlayers = players.length;

    // Calculate how many complete groups of 4 we have
    const numGroups = Math.ceil(totalPlayers / 4);

    // Normalize rotation index to wrap around
    const currentGroup = rotationIndex % numGroups;

    // Calculate which players should get questions this round
    const startIndex = currentGroup * 4;
    const playersThisRound: Player[] = [];

    // Select 4 players starting from startIndex, wrapping around if needed
    for (let i = 0; i < 4 && i < totalPlayers; i++) {
        const playerIndex = (startIndex + i) % totalPlayers;
        playersThisRound.push(players[playerIndex]);
    }

    // Build a map of previous questions for smart assignment
    const previousAssignments = new Map<string, QuestionType>();
    playersThisRound.forEach(p => {
        if (p.previousQuestion) {
            previousAssignments.set(p.id, p.previousQuestion);
        }
    });

    // Shuffle the selected players for question variety
    const shuffledPlayers = [...playersThisRound].sort(() => Math.random() - 0.5);
    const availableQuestions = [...QUESTIONS];

    // Assign questions avoiding repeats when possible
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

    // Apply assignments to ALL players
    for (const player of players) {
        const question = assignments.get(player.id);
        if (question) {
            player.previousQuestion = player.assignedQuestion; // Save current as previous
            player.assignedQuestion = question;
            player.hasAnswered = false;
        } else {
            // Player doesn't have a question this round (they watch)
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

    // Use rotational assignment for questions
    assignQuestionsWithRotation(room.players, room.gameState.rotationIndex);

    room.gameState.phase = 'playing';
    room.gameState.currentRound++;
    room.gameState.currentTurnIndex = 0;
    room.gameState.answers = {};
    room.gameState.questionOrder = QUESTIONS;
    // Increment rotation index for next round
    room.gameState.rotationIndex++;

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
 * Helper to check if text starts with a preposition and remove template preposition if needed
 */
function formatWithPreposition(answer: string, defaultPreposition: string): string {
    const lowerAnswer = answer.toLowerCase().trim();

    // Common prepositions that users might include
    const prepositions = ['with', 'at', 'in', 'on', 'by', 'near', 'inside', 'outside', 'under', 'over', 'behind', 'beside', 'between', 'around', 'through', 'during', 'while', 'after', 'before'];

    // Check if answer starts with any preposition
    const startsWithPreposition = prepositions.some(prep =>
        lowerAnswer.startsWith(prep + ' ') || lowerAnswer === prep
    );

    if (startsWithPreposition) {
        // User included preposition, don't add another
        return answer;
    }

    // User didn't include preposition, add the default one
    return `${defaultPreposition} ${answer}`;
}

/**
 * Lightweight sentence grammar formatter
 * Cleans up common issues in the generated sentence
 */
function formatSentence(sentence: string): string {
    let result = sentence;

    // 1. Fix multiple spaces
    result = result.replace(/\s+/g, ' ');

    // 2. Fix space before punctuation
    result = result.replace(/\s+([.,!?;:])/g, '$1');

    // 3. Fix missing space after punctuation (except at end)
    result = result.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

    // 4. Fix double punctuation
    result = result.replace(/([.,!?])+/g, '$1');

    // 5. Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // 6. Ensure sentence ends with a period
    result = result.trim();
    if (!/[.!?]$/.test(result)) {
        result += '.';
    }

    // 7. Fix "a" to "an" before vowels
    result = result.replace(/\ba ([aeiouAEIOU])/g, 'an $1');

    // 8. Fix common word repetitions (the the, a a, etc.)
    result = result.replace(/\b(the|a|an|is|was|were|are|and|or|but|in|on|at|to|for)\s+\1\b/gi, '$1');

    // 9. Fix comma before period
    result = result.replace(/,\./g, '.');

    // 10. Trim and return
    return result.trim();
}

/**
 * Generate reveal data from answers
 */
export function generateReveal(room: Room): RevealData | null {
    const { answers } = room.gameState;

    if (!answers.who || !answers.withWhom || !answers.where || !answers.how) {
        return null;
    }

    const who = answers.who.answer.trim();
    const withWhom = answers.withWhom.answer.trim();
    const where = answers.where.answer.trim();
    const how = answers.how.answer.trim();

    // Build sentence with smart preposition handling
    const withWhomPart = formatWithPreposition(withWhom, 'with');
    const wherePart = formatWithPreposition(where, 'at');

    // For "how", lowercase the first letter if it starts with a capital
    const howFormatted = how.charAt(0).toLowerCase() + how.slice(1);

    // Build raw sentence
    const rawSentence = `${who} was ${withWhomPart} ${wherePart}, ${howFormatted}.`;

    // Apply grammar formatting
    const sentence = formatSentence(rawSentence);

    return { who, withWhom, where, how, sentence };
}

/**
 * Start a new round
 */
export async function startNewRound(roomCode: string): Promise<Room | null> {
    const room = await getRoom(roomCode);
    if (!room || room.gameState.phase !== 'reveal') return null;

    // Use rotational assignment - next group of players gets questions
    assignQuestionsWithRotation(room.players, room.gameState.rotationIndex);

    room.gameState.phase = 'playing';
    room.gameState.currentRound++;
    room.gameState.currentTurnIndex = 0;
    room.gameState.answers = {};
    // Increment rotation index for next round
    room.gameState.rotationIndex++;

    await saveRoom(room);
    return room;
}

/**
 * Reset game to lobby - allows host to change settings and start fresh
 */
export async function resetToLobby(
    roomCode: string,
    newSettings?: Partial<{ maxPlayers: number; timerSeconds: number }>
): Promise<Room | null> {
    const room = await getRoom(roomCode);
    if (!room) return null;

    // Update settings if provided
    if (newSettings) {
        if (newSettings.maxPlayers !== undefined) {
            room.settings.maxPlayers = newSettings.maxPlayers;
        }
        if (newSettings.timerSeconds !== undefined) {
            room.settings.timerSeconds = newSettings.timerSeconds;
        }
    }

    // Reset game state to lobby
    room.gameState.phase = 'lobby';
    room.gameState.currentRound = 0;
    room.gameState.answers = {};
    room.gameState.currentTurnIndex = 0;
    room.gameState.rotationIndex = 0;

    // Clear all player question assignments
    for (const player of room.players) {
        player.assignedQuestion = undefined;
        player.hasAnswered = false;
        player.previousQuestion = undefined;
        player.isReady = false;
    }

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
