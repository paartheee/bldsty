// Configuration for Blind Story game

import { Question } from "@/types";

export const config = {
  // Redis settings
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0"),
  },

  // Game settings
  game: {
    roomCodeLength: 6,
    roomExpirySeconds: 7200, // 2 hours
    maxPlayersPerRoom: 10,
    minPlayersToStart: 1,
    reconnectionGracePeriod: 300, // 5 minutes
  },

  // Content moderation
  moderation: {
    enabled: true,
    profanityFilterEnabled: true,
    maxAnswerLength: 200,
  },

  // Questions (fixed order)
  questions: [
    { id: "who", text: "Who?", order: 1 },
    { id: "with_whom", text: "With whom?", order: 2 },
    { id: "where", text: "Where?", order: 3 },
    { id: "how", text: "How?", order: 4 },
  ] as Question[],

  // Sentence template
  sentenceTemplate: "{who} was with {with_whom} at {where}, and they did it {how}.",
};
