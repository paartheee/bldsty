import { config } from 'dotenv';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { connectRedis } from './lib/redis-client';
import { setupSocketHandlers } from './lib/socket-handler';
import type { ServerToClientEvents, ClientToServerEvents } from './types/game';

// Load environment variables from .env file
config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // Initialize Socket.IO
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: dev ? 'http://localhost:3000' : process.env.NEXT_PUBLIC_APP_URL,
            methods: ['GET', 'POST']
        },
        path: '/api/socket'
    });

    // Connect to Redis
    try {
        await connectRedis();
        console.log('✅ Redis connected');
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        console.error('Please check your .env file and Redis configuration');
        process.exit(1);
    }

    // Setup Socket.IO handlers
    setupSocketHandlers(io);
    console.log('✅ Socket.IO handlers registered');

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`🚀 Ready on http://${hostname}:${port}`);
        });
});
