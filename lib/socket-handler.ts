import type { Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/game';
import {
    createRoom,
    joinRoom,
    removePlayer,
    startGame,
    submitAnswer,
    generateReveal,
    startNewRound
} from './game-engine';
import { getRoom, deleteRoom } from './redis-client';

type SocketType = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store socket-to-room mapping
const socketRooms = new Map<string, string>();

export function setupSocketHandlers(io: any) {
    io.on('connection', (socket: SocketType) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // CREATE ROOM
        socket.on('create-room', async (playerName, settings, callback) => {
            try {
                const room = await createRoom(socket.id, playerName, settings);

                // Join socket room
                await socket.join(room.code);
                socketRooms.set(socket.id, room.code);

                console.log(`🎮 Room created: ${room.code} by ${playerName}`);
                callback(room.code);

                // Notify room
                io.to(room.code).emit('room-updated', room);
            } catch (error) {
                console.error('Error creating room:', error);
                socket.emit('error', 'Failed to create room');
            }
        });

        // JOIN ROOM
        socket.on('join-room', async (roomCode, playerName, callback) => {
            try {
                const result = await joinRoom(roomCode.toUpperCase(), socket.id, playerName);

                if (!result.success || !result.room) {
                    callback(false, result.error);
                    return;
                }

                // Join socket room
                await socket.join(roomCode.toUpperCase());
                socketRooms.set(socket.id, roomCode.toUpperCase());

                console.log(`👤 ${playerName} joined room ${roomCode}`);
                callback(true);

                // Notify all players in room
                const player = result.room.players.find(p => p.id === socket.id);
                if (player) {
                    io.to(roomCode.toUpperCase()).emit('player-joined', player);
                }
                io.to(roomCode.toUpperCase()).emit('room-updated', result.room);
            } catch (error) {
                console.error('Error joining room:', error);
                callback(false, 'Failed to join room');
            }
        });

        // START GAME
        socket.on('start-game', async () => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                const room = await getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    socket.emit('error', 'Only host can start the game');
                    return;
                }

                const updatedRoom = await startGame(roomCode);
                if (!updatedRoom) {
                    socket.emit('error', 'Failed to start game');
                    return;
                }

                console.log(`🎯 Game started in room ${roomCode}`);

                // Notify all players
                io.to(roomCode).emit('game-started', updatedRoom);

                // Notify each player of their question
                updatedRoom.players.forEach(player => {
                    if (player.assignedQuestion) {
                        io.to(player.id).emit('your-turn', player.assignedQuestion);
                    }
                });
            } catch (error: any) {
                console.error('Error starting game:', error);
                socket.emit('error', error.message || 'Failed to start game');
            }
        });

        // SUBMIT ANSWER
        socket.on('submit-answer', async (answer) => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                const result = await submitAnswer(roomCode, socket.id, answer);

                if (!result.success || !result.room) {
                    socket.emit('error', result.error || 'Failed to submit answer');
                    return;
                }

                console.log(`✍️ Answer submitted in room ${roomCode}`);

                // Update room state
                io.to(roomCode).emit('room-updated', result.room);

                // If all answers are in, trigger reveal
                if (result.shouldReveal) {
                    const revealData = generateReveal(result.room);
                    if (revealData) {
                        console.log(`🎉 Revealing in room ${roomCode}: ${revealData.sentence}`);

                        // Dramatic pause before reveal
                        setTimeout(() => {
                            io.to(roomCode).emit('reveal', revealData);
                        }, 1000);
                    }
                } else {
                    // Notify player to wait
                    socket.emit('waiting-for-others');
                }
            } catch (error) {
                console.error('Error submitting answer:', error);
                socket.emit('error', 'Failed to submit answer');
            }
        });

        // NEW ROUND
        socket.on('new-round', async () => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                const room = await getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    socket.emit('error', 'Only host can start new round');
                    return;
                }

                const updatedRoom = await startNewRound(roomCode);
                if (!updatedRoom) {
                    socket.emit('error', 'Failed to start new round');
                    return;
                }

                console.log(`🔄 New round started in room ${roomCode}`);

                // Notify all players
                io.to(roomCode).emit('game-started', updatedRoom);

                // Notify each player of their new question
                updatedRoom.players.forEach(player => {
                    if (player.assignedQuestion) {
                        io.to(player.id).emit('your-turn', player.assignedQuestion);
                    }
                });
            } catch (error) {
                console.error('Error starting new round:', error);
                socket.emit('error', 'Failed to start new round');
            }
        });

        // KICK PLAYER
        socket.on('kick-player', async (playerId) => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                const room = await getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    socket.emit('error', 'Only host can kick players');
                    return;
                }

                // Notify kicked player
                io.to(playerId).emit('kicked');

                // Remove from socket room
                const kickedSocket = io.sockets.sockets.get(playerId);
                if (kickedSocket) {
                    kickedSocket.leave(roomCode);
                    socketRooms.delete(playerId);
                }

                // Update room state
                const updatedRoom = await removePlayer(roomCode, playerId);
                if (updatedRoom) {
                    io.to(roomCode).emit('player-left', playerId);
                    io.to(roomCode).emit('room-updated', updatedRoom);
                }

                console.log(`👢 Player ${playerId} kicked from room ${roomCode}`);
            } catch (error) {
                console.error('Error kicking player:', error);
                socket.emit('error', 'Failed to kick player');
            }
        });

        // DISCONNECT
        socket.on('disconnect', async () => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                console.log(`🔌 Client disconnected: ${socket.id} from room ${roomCode}`);

                const updatedRoom = await removePlayer(roomCode, socket.id);

                if (updatedRoom) {
                    // Notify remaining players
                    io.to(roomCode).emit('player-left', socket.id);
                    io.to(roomCode).emit('room-updated', updatedRoom);
                } else {
                    // Room is empty, delete it
                    await deleteRoom(roomCode);
                    console.log(`🗑️ Room ${roomCode} deleted (empty)`);
                }

                socketRooms.delete(socket.id);
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
}
