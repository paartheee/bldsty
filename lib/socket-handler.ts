import type { Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/game';
import {
    createRoom,
    joinRoom,
    removePlayer,
    startGame,
    submitAnswer,
    generateReveal,
    startNewRound,
    resetToLobby
} from './game-engine';
import { getRoom, deleteRoom, saveRoom } from './redis-client';

type SocketType = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store socket-to-room mapping
const socketRooms = new Map<string, string>();

// Store pending disconnections (for grace period)
const pendingDisconnects = new Map<string, { roomCode: string; playerId: string; timeout: NodeJS.Timeout }>();

// Grace period before removing disconnected players (30 seconds)
const DISCONNECT_GRACE_PERIOD = 30000;

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

                // Send room data directly in callback to ensure client receives it immediately
                callback(room.code, room);

                // Also notify room (for any other listeners)
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

        // REJOIN ROOM (for reconnection after tab switch/disconnect)
        socket.on('rejoin-room', async (roomCode, playerId, playerName, callback) => {
            try {
                const room = await getRoom(roomCode.toUpperCase());

                if (!room) {
                    callback(false, undefined, 'Room not found');
                    return;
                }

                // Check if there's a pending disconnect for this player
                const pendingKey = `${roomCode.toUpperCase()}-${playerId}`;
                const pending = pendingDisconnects.get(pendingKey);
                if (pending) {
                    // Cancel the pending removal
                    clearTimeout(pending.timeout);
                    pendingDisconnects.delete(pendingKey);
                    console.log(`🔄 Cancelled pending disconnect for ${playerName}`);
                }

                // Find existing player or check if they were in the room
                const player = room.players.find(p => p.id === playerId);

                if (player) {
                    // Player still exists - update their socket ID
                    const oldSocketId = player.id;
                    player.id = socket.id;

                    // Update host if needed
                    if (room.hostId === oldSocketId) {
                        room.hostId = socket.id;
                    }

                    await saveRoom(room);

                    // Join socket room
                    await socket.join(roomCode.toUpperCase());
                    socketRooms.set(socket.id, roomCode.toUpperCase());

                    console.log(`🔄 ${playerName} rejoined room ${roomCode}`);
                    callback(true, room);

                    // Send current game state
                    io.to(roomCode.toUpperCase()).emit('room-updated', room);

                    // If game is in progress, send the player's question
                    if (room.gameState.phase === 'playing' && player.assignedQuestion) {
                        socket.emit('your-turn', player.assignedQuestion);
                    }
                } else {
                    // Player was removed - try to rejoin as new player if in lobby
                    if (room.gameState.phase === 'lobby') {
                        const result = await joinRoom(roomCode.toUpperCase(), socket.id, playerName);
                        if (result.success && result.room) {
                            await socket.join(roomCode.toUpperCase());
                            socketRooms.set(socket.id, roomCode.toUpperCase());
                            callback(true, result.room);
                            io.to(roomCode.toUpperCase()).emit('room-updated', result.room);
                        } else {
                            callback(false, undefined, result.error || 'Failed to rejoin');
                        }
                    } else {
                        callback(false, undefined, 'Game already in progress');
                    }
                }
            } catch (error) {
                console.error('Error rejoining room:', error);
                callback(false, undefined, 'Failed to rejoin room');
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

        // LEAVE ROOM (Explicit)
        socket.on('leave-room', async () => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                console.log(`👋 Player left explicitly: ${socket.id} from room ${roomCode}`);

                // Remove from socket room
                socket.leave(roomCode);
                socketRooms.delete(socket.id);

                // Update room state (this handles host reassignment)
                const updatedRoom = await removePlayer(roomCode, socket.id);

                if (updatedRoom) {
                    io.to(roomCode).emit('player-left', socket.id);
                    io.to(roomCode).emit('room-updated', updatedRoom);
                } else {
                    // Room is empty, delete it
                    await deleteRoom(roomCode);
                    console.log(`🗑️ Room ${roomCode} deleted (empty)`);
                }
            } catch (error) {
                console.error('Error leaving room:', error);
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

        // RESET TO LOBBY
        socket.on('reset-to-lobby', async (newSettings) => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                const room = await getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    socket.emit('error', 'Only host can reset to lobby');
                    return;
                }

                const updatedRoom = await resetToLobby(roomCode, newSettings);
                if (!updatedRoom) {
                    socket.emit('error', 'Failed to reset to lobby');
                    return;
                }

                console.log(`🔄 Game reset to lobby in room ${roomCode}`);

                // Notify all players to return to lobby
                io.to(roomCode).emit('game-reset');
                io.to(roomCode).emit('room-updated', updatedRoom);
            } catch (error) {
                console.error('Error resetting to lobby:', error);
                socket.emit('error', 'Failed to reset to lobby');
            }
        });

        // DISCONNECT
        socket.on('disconnect', async () => {
            try {
                const roomCode = socketRooms.get(socket.id);
                if (!roomCode) return;

                console.log(`🔌 Client disconnected: ${socket.id} from room ${roomCode}`);

                // Get the room to find the player
                const room = await getRoom(roomCode);
                if (!room) {
                    socketRooms.delete(socket.id);
                    return;
                }

                const player = room.players.find(p => p.id === socket.id);
                const pendingKey = `${roomCode}-${socket.id}`;

                // Set up delayed removal with grace period
                const timeout = setTimeout(async () => {
                    try {
                        console.log(`⏰ Grace period expired for ${player?.name || socket.id} in room ${roomCode}`);
                        pendingDisconnects.delete(pendingKey);

                        const currentRoom = await getRoom(roomCode);
                        if (!currentRoom) return;

                        // Check if player is still in the room (might have rejoined with new socket)
                        const stillInRoom = currentRoom.players.find(p => p.id === socket.id);
                        if (!stillInRoom) return; // Player already removed or rejoined with new ID

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
                    } catch (error) {
                        console.error('Error in delayed disconnect:', error);
                    }
                }, DISCONNECT_GRACE_PERIOD);

                pendingDisconnects.set(pendingKey, {
                    roomCode,
                    playerId: socket.id,
                    timeout
                });

                console.log(`⏳ Grace period started for ${player?.name || socket.id} (${DISCONNECT_GRACE_PERIOD / 1000}s)`);

                socketRooms.delete(socket.id);
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
}
