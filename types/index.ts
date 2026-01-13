// Type definitions for Blind Story game

export interface Player {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  is_host: boolean;
}

export interface Question {
  id: string;
  text: string;
  order: number;
}

export interface Answer {
  player_id: string;
  answer: string;
  timestamp: number;
}

export interface Room {
  code: string;
  host_id: string;
  players: Record<string, Player>;
  status: "lobby" | "in_game" | "reveal";
  current_round: number;
  settings: RoomSettings;
  question_assignments?: Record<string, string>;
  current_question_index?: number;
  answers_submitted?: number;
  created_at: number;
}

export interface RoomSettings {
  max_players: number;
  moderation_enabled: boolean;
  language: string;
}

export interface RoundHistory {
  round: number;
  sentence: string;
  answers: Record<string, Answer>;
  timestamp: number;
}

export interface AnswerBreakdown {
  question: string;
  answer: string;
  player_name: string;
}

// Socket.IO event types
export interface ServerToClientEvents {
  join_success: (data: { room_code: string; player_id: string; room: Room; is_reconnection: boolean }) => void;
  join_error: (data: { message: string }) => void;
  room_update: (data: { room: Room }) => void;
  game_started: (data: { room: Room }) => void;
  your_turn: (data: { question: Question; progress: string }) => void;
  waiting: (data: { current_player: string; progress: string }) => void;
  submit_success: (data: { question_id: string }) => void;
  submit_error: (data: { message: string }) => void;
  reveal: (data: { sentence: string; answers: AnswerBreakdown[]; round: number }) => void;
  returned_to_lobby: (data: { room: Room }) => void;
  player_disconnected: (data: { player_id: string; player_name: string }) => void;
  kicked: (data: { message: string }) => void;
  error: (data: { message: string }) => void;
  history_data: (data: { history: RoundHistory[] }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { room_code: string; player_name: string; player_id?: string }) => void;
  leave_room: (data: { room_code: string }) => void;
  kick_player: (data: { room_code: string; player_id: string }) => void;
  player_ready: (data: { room_code: string; ready: boolean }) => void;
  start_game: (data: { room_code: string }) => void;
  submit_answer: (data: { room_code: string; question_id: string; answer: string }) => void;
  new_round: (data: { room_code: string }) => void;
  return_to_lobby: (data: { room_code: string }) => void;
  get_history: (data: { room_code: string }) => void;
  request_reveal: (data: { room_code: string }) => void;
}
