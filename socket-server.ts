import { config } from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectRedis } from './lib/redis-client';
import { setupSocketHandlers } from './lib/socket-handler';
import type { ServerToClientEvents, ClientToServerEvents } from './types/game';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://bldsty.vercel.app'];

// Create standalone HTTP server for Socket.IO
const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Blind Story Socket.IO Server');
});

// Initialize Socket.IO with CORS
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// Connect to Redis and setup handlers
async function startServer() {
    try {
        await connectRedis();
        console.log('✅ Redis connected');

        setupSocketHandlers(io);
        console.log('✅ Socket.IO handlers registered');

        httpServer.listen(PORT, () => {
            console.log(`🚀 Socket.IO server running on port ${PORT}`);
            console.log(`📡 Accepting connections from: ${ALLOWED_ORIGINS.join(', ')}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing server...');
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing server...');
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

startServer();
