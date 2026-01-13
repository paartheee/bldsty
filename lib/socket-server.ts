import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/game';

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | undefined;

export function getIO(httpServer?: NetServer): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
    if (!io && httpServer) {
        io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
            cors: {
                origin: process.env.NODE_ENV === 'production'
                    ? process.env.NEXT_PUBLIC_APP_URL
                    : 'http://localhost:3000',
                methods: ['GET', 'POST']
            },
            path: '/api/socket'
        });

        console.log('✅ Socket.IO server initialized');
    }

    if (!io) {
        throw new Error('Socket.IO not initialized');
    }

    return io;
}

export { io };
