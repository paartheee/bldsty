import { createClient } from 'redis';
import type { Room } from '@/types/game';

let redisClient: ReturnType<typeof createClient> | null = null;
let isConnected = false;
let connectionPromise: Promise<ReturnType<typeof createClient>> | null = null;

function getRedisClient() {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        console.log('🔗 Connecting to Redis:', redisUrl.replace(/:[^:@]+@/, ':****@')); // Log URL with password masked
        redisClient = createClient({ url: redisUrl });
        redisClient.on('error', (err) => console.error('Redis Client Error', err));
    }
    return redisClient;
}

export async function connectRedis() {
    const client = getRedisClient();

    if (isConnected) {
        return client;
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async () => {
        try {
            if (!client.isOpen) {
                await client.connect();
                isConnected = true;
                console.log('✅ Redis connected');
            }
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            connectionPromise = null;
            throw error;
        }
        return client;
    })();

    return connectionPromise;
}

// Room operations
const ROOM_PREFIX = 'room:';
const ROOM_TTL = 3600 * 4; // 4 hours

export async function saveRoom(room: Room): Promise<void> {
    const client = await connectRedis();
    await client.setEx(
        `${ROOM_PREFIX}${room.code}`,
        ROOM_TTL,
        JSON.stringify(room)
    );
}

export async function getRoom(roomCode: string): Promise<Room | null> {
    const client = await connectRedis();
    const data = await client.get(`${ROOM_PREFIX}${roomCode}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteRoom(roomCode: string): Promise<void> {
    const client = await connectRedis();
    await client.del(`${ROOM_PREFIX}${roomCode}`);
}

export async function roomExists(roomCode: string): Promise<boolean> {
    const client = await connectRedis();
    const exists = await client.exists(`${ROOM_PREFIX}${roomCode}`);
    return exists === 1;
}

// Cleanup on shutdown
process.on('SIGINT', async () => {
    if (isConnected && redisClient) {
        await redisClient.quit();
        console.log('Redis connection closed');
    }
    process.exit(0);
});
