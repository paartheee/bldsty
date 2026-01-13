// Redis client singleton

import { createClient } from "redis";
import { config } from "./config";

const redisConfig = {
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password,
  database: config.redis.db,
};

const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createClient> | undefined;
};

export const redis =
  globalForRedis.redis ??
  createClient(redisConfig);

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// Connect to Redis
if (!redis.isOpen) {
  redis.connect().catch(console.error);
}

redis.on("error", (err) => console.error("Redis Client Error", err));
redis.on("connect", () => console.log("✅ Redis Connected"));

export default redis;
