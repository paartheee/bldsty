// Game state management with Redis

import { nanoid, customAlphabet } from "nanoid";
import redis from "./redis";
import { config } from "./config";
import type { Room, Player, Answer, RoundHistory, RoomSettings } from "@/types";

const generateCode = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", config.game.roomCodeLength);

export class GameState {
  private getKey(type: string, ...parts: string[]): string {
    return `bldsty:${type}:${parts.join(":")}`;
  }

  async roomExists(roomCode: string): Promise<boolean> {
    const exists = await redis.exists(this.getKey("room", roomCode));
    return exists === 1;
  }

  async generateRoomCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 10) throw new Error("Failed to generate unique room code");
    } while (await this.roomExists(code));
    return code;
  }

  async createRoom(roomCode: string, hostId: string, settings: RoomSettings): Promise<Room> {
    const room: Room = {
      code: roomCode,
      host_id: hostId,
      players: {},
      status: "lobby",
      current_round: 0,
      settings,
      created_at: Date.now(),
    };

    await redis.setEx(
      this.getKey("room", roomCode),
      config.game.roomExpirySeconds,
      JSON.stringify(room)
    );

    return room;
  }

  async getRoom(roomCode: string): Promise<Room | null> {
    const data = await redis.get(this.getKey("room", roomCode));
    return data ? JSON.parse(data) : null;
  }

  async updateRoom(roomCode: string, room: Room): Promise<void> {
    await redis.setEx(
      this.getKey("room", roomCode),
      config.game.roomExpirySeconds,
      JSON.stringify(room)
    );
  }

  async deleteRoom(roomCode: string): Promise<void> {
    await redis.del(this.getKey("room", roomCode));
    // Clean up answers and history
    const pattern = this.getKey("answers", roomCode, "*");
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
    await redis.del(this.getKey("history", roomCode));
  }

  async addPlayer(roomCode: string, playerId: string, playerName: string): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    if (!room) return false;

    if (Object.keys(room.players).length >= config.game.maxPlayersPerRoom) {
      return false;
    }

    room.players[playerId] = {
      id: playerId,
      name: playerName,
      ready: false,
      connected: true,
      is_host: playerId === room.host_id,
    };

    await this.updateRoom(roomCode, room);
    return true;
  }

  async removePlayer(roomCode: string, playerId: string): Promise<void> {
    const room = await this.getRoom(roomCode);
    if (!room) return;

    delete room.players[playerId];

    // If host left, assign new host
    if (room.host_id === playerId && Object.keys(room.players).length > 0) {
      const newHostId = Object.keys(room.players)[0];
      room.host_id = newHostId;
      room.players[newHostId].is_host = true;
    }

    // Delete room if empty
    if (Object.keys(room.players).length === 0) {
      await this.deleteRoom(roomCode);
    } else {
      await this.updateRoom(roomCode, room);
    }
  }

  async setPlayerReady(roomCode: string, playerId: string, ready: boolean): Promise<void> {
    const room = await this.getRoom(roomCode);
    if (room && room.players[playerId]) {
      room.players[playerId].ready = ready;
      await this.updateRoom(roomCode, room);
    }
  }

  private assignQuestions(playerIds: string[]): Record<string, string> {
    const assignments: Record<string, string> = {};

    config.questions.forEach((question, i) => {
      // Cycle through players if fewer than 4
      const playerIndex = i % playerIds.length;
      assignments[question.id] = playerIds[playerIndex];
    });

    return assignments;
  }

  async startGame(roomCode: string): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    if (!room || room.status !== "lobby") return false;

    // Initialize round
    room.status = "in_game";
    room.current_round += 1;

    // Assign questions to players
    const playerIds = Object.keys(room.players);
    room.question_assignments = this.assignQuestions(playerIds);
    room.current_question_index = 0;
    room.answers_submitted = 0;

    await this.updateRoom(roomCode, room);
    return true;
  }

  async submitAnswer(
    roomCode: string,
    questionId: string,
    playerId: string,
    answer: string
  ): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    if (!room || room.status !== "in_game") return false;

    // Verify this player is assigned to this question
    if (room.question_assignments?.[questionId] !== playerId) return false;

    // Get current answers
    const answers = await this.getRoundAnswers(roomCode, room.current_round);

    // Prevent re-submission
    if (answers[questionId]) return false;

    // Store answer
    answers[questionId] = {
      player_id: playerId,
      answer,
      timestamp: Date.now(),
    };

    await redis.setEx(
      this.getKey("answers", roomCode, room.current_round.toString()),
      config.game.roomExpirySeconds,
      JSON.stringify(answers)
    );

    // Update room state
    room.answers_submitted = (room.answers_submitted || 0) + 1;
    room.current_question_index = (room.current_question_index || 0) + 1;

    // Check if all answers submitted
    if (room.answers_submitted >= config.questions.length) {
      room.status = "reveal";
    }

    await this.updateRoom(roomCode, room);
    return true;
  }

  async getRoundAnswers(roomCode: string, roundNum: number): Promise<Record<string, Answer>> {
    const data = await redis.get(this.getKey("answers", roomCode, roundNum.toString()));
    return data ? JSON.parse(data) : {};
  }

  async getCombinedSentence(roomCode: string, roundNum: number): Promise<string | null> {
    const answers = await this.getRoundAnswers(roomCode, roundNum);

    if (Object.keys(answers).length < config.questions.length) {
      return null;
    }

    // Build sentence using template
    let sentence = config.sentenceTemplate;
    config.questions.forEach((q) => {
      sentence = sentence.replace(`{${q.id}}`, answers[q.id].answer);
    });

    return sentence;
  }

  async saveRoundToHistory(roomCode: string, roundNum: number): Promise<void> {
    const answers = await this.getRoundAnswers(roomCode, roundNum);
    const sentence = await this.getCombinedSentence(roomCode, roundNum);

    const historyData: RoundHistory = {
      round: roundNum,
      sentence: sentence || "",
      answers,
      timestamp: Date.now(),
    };

    const history = await this.getRoomHistory(roomCode);
    history.push(historyData);

    await redis.setEx(
      this.getKey("history", roomCode),
      config.game.roomExpirySeconds,
      JSON.stringify(history)
    );
  }

  async getRoomHistory(roomCode: string): Promise<RoundHistory[]> {
    const data = await redis.get(this.getKey("history", roomCode));
    return data ? JSON.parse(data) : [];
  }

  async startNewRound(roomCode: string): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    if (!room || room.status !== "reveal") return false;

    // Save current round to history
    await this.saveRoundToHistory(roomCode, room.current_round);

    // Reset for new round
    room.status = "in_game";
    room.current_round += 1;

    // Re-assign questions (shuffled)
    const playerIds = Object.keys(room.players);
    // Shuffle player order
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    room.question_assignments = this.assignQuestions(shuffled);

    room.current_question_index = 0;
    room.answers_submitted = 0;

    await this.updateRoom(roomCode, room);
    return true;
  }

  async returnToLobby(roomCode: string): Promise<boolean> {
    const room = await this.getRoom(roomCode);
    if (!room) return false;

    // Save current round to history if in reveal
    if (room.status === "reveal") {
      await this.saveRoundToHistory(roomCode, room.current_round);
    }

    room.status = "lobby";

    // Reset player ready states
    Object.keys(room.players).forEach((playerId) => {
      room.players[playerId].ready = false;
    });

    await this.updateRoom(roomCode, room);
    return true;
  }
}

// Export singleton
export const gameState = new GameState();
