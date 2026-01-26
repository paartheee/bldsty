'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, RoomSettings, GamePhase } from '@/types/game';
import Lobby from '@/components/Lobby';
import GameBoard from '@/components/GameBoard';
import RevealScreen from '@/components/RevealScreen';
import Modal, { ModalType } from '@/components/Modal';
import AdBanner from '@/components/AdBanner';
import { Sparkles, Users, LogIn } from 'lucide-react';

let socket: Socket<ServerToClientEvents, ClientToServerEvents>;

// Session storage keys
const SESSION_KEY = 'blindstory_session';

interface StoredSession {
    roomCode: string;
    playerId: string;
    playerName: string;
    view: 'home' | 'lobby' | 'game' | 'reveal';
    timestamp: number;
}

// Save session to sessionStorage (tab-specific)
function saveSession(roomCode: string, playerId: string, playerName: string, view: 'home' | 'lobby' | 'game' | 'reveal') {
    const session: StoredSession = {
        roomCode,
        playerId,
        playerName,
        view,
        timestamp: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Get session from sessionStorage (valid for 30 minutes)
function getSession(): StoredSession | null {
    try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (!stored) return null;

        const session: StoredSession = JSON.parse(stored);
        const thirtyMinutes = 30 * 60 * 1000;

        if (Date.now() - session.timestamp > thirtyMinutes) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }

        return session;
    } catch {
        return null;
    }
}

// Clear session from sessionStorage
function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
}

export default function Home() {
    const [view, setView] = useState<'home' | 'lobby' | 'game' | 'reveal'>('home');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const hasAttemptedRejoin = useRef(false);
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        type: ModalType;
        title?: string;
        message: string;
    }>({ isOpen: false, type: 'error', message: '' });

    const { setConnected, setPlayer, setRoom, setMyQuestion, setError, room, playerId, playerName } = useGameStore();

    // Save session when view or room changes
    useEffect(() => {
        if (room && playerId && playerName && view !== 'home') {
            saveSession(room.code, playerId, playerName, view);
        }
    }, [room, playerId, playerName, view]);

    useEffect(() => {
        // Initialize Socket.IO - connect to external server in production
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socket.on('connect', () => {
            console.log('Connected to server');
            setConnected(true);
            setPlayer(socket.id!, '');

            // Try to rejoin if we have a stored session
            const session = getSession();
            if (session && !hasAttemptedRejoin.current) {
                hasAttemptedRejoin.current = true;
                setIsReconnecting(true);
                console.log('Attempting to rejoin room:', session.roomCode);

                socket.emit('rejoin-room', session.roomCode, session.playerId, session.playerName, (success, updatedRoom, error) => {
                    setIsReconnecting(false);
                    if (success && updatedRoom) {
                        console.log('Rejoined room successfully');
                        setRoom(updatedRoom);
                        setPlayer(socket.id!, session.playerName);

                        // Restore the appropriate view based on game phase
                        const phase: GamePhase = updatedRoom.gameState.phase;
                        if (phase === 'lobby') {
                            setView('lobby');
                        } else if (phase === 'playing') {
                            setView('game');
                        } else if (phase === 'reveal') {
                            setView('reveal');
                        }

                        // Update session with new socket ID
                        saveSession(session.roomCode, socket.id!, session.playerName, phase === 'lobby' ? 'lobby' : phase === 'playing' ? 'game' : 'reveal');
                    } else {
                        console.log('Failed to rejoin:', error);
                        clearSession();
                        setView('home');
                    }
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnected(false);
            // Don't clear session on disconnect - we want to be able to rejoin
            hasAttemptedRejoin.current = false; // Allow rejoin attempt on next connect
        });

        socket.on('room-updated', (updatedRoom) => {
            setRoom(updatedRoom);
        });

        socket.on('game-started', (updatedRoom) => {
            setRoom(updatedRoom);
            setView('game');
        });

        socket.on('your-turn', (question) => {
            setMyQuestion(question);
        });

        socket.on('waiting-for-others', () => {
            // Player has submitted, waiting for others
        });

        socket.on('reveal', () => {
            setView('reveal');
        });

        socket.on('player-joined', () => {
            // Room will be updated via room-updated event
        });

        socket.on('player-left', () => {
            // Room will be updated via room-updated event
        });


        socket.on('error', (message) => {
            console.error('Socket error:', message);
            setError(message);

            // Show modal for specific errors
            if (message.toLowerCase().includes('full')) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Room Full',
                    message: 'This room has reached its maximum capacity. Please try another room.'
                });
                setView('home');
            } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('exist')) {
                setModalState({
                    isOpen: true,
                    type: 'error',
                    title: 'Room Not Found',
                    message: 'This room does not exist. Please check the room code and try again.'
                });
                setView('home');
            } else {
                // For other errors, show brief notification
                setTimeout(() => setError(null), 3000);
            }
        });


        socket.on('kicked', () => {
            clearSession();
            setView('home');
            setModalState({
                isOpen: true,
                type: 'error',
                title: 'Removed from Room',
                message: 'You have been removed from the room by the host.'
            });
        });

        return () => {
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateRoom = (name: string, settings: RoomSettings) => {
        socket.emit('create-room', name, settings, (roomCode, roomData) => {
            if (roomCode && roomData) {
                setPlayer(socket.id!, name);
                setRoom(roomData);  // Set room immediately from callback
                setShowCreateModal(false);
                setView('lobby');
                // Session will be saved by the useEffect when room is updated
            } else {
                setError('Failed to create room');
                setTimeout(() => setError(null), 3000);
            }
        });
    };

    const handleJoinRoom = (roomCode: string, name: string) => {
        socket.emit('join-room', roomCode, name, (success, error) => {
            if (success) {
                setPlayer(socket.id!, name);
                setShowJoinModal(false);
                setView('lobby');
                // Session will be saved by the useEffect when room is updated
            } else {
                const errorMsg = error || 'Failed to join room';

                // Show modal for specific errors
                if (errorMsg.toLowerCase().includes('full')) {
                    setShowJoinModal(false);
                    setModalState({
                        isOpen: true,
                        type: 'error',
                        title: 'Room Full',
                        message: 'This room has reached its maximum capacity. Please try another room or wait for a spot to open up.'
                    });
                } else if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('exist')) {
                    setShowJoinModal(false);
                    setModalState({
                        isOpen: true,
                        type: 'error',
                        title: 'Room Not Found',
                        message: 'This room does not exist. Please check the room code and try again.'
                    });
                } else if (errorMsg.toLowerCase().includes('progress')) {
                    setShowJoinModal(false);
                    setModalState({
                        isOpen: true,
                        type: 'info',
                        title: 'Game In Progress',
                        message: 'This game has already started. Please wait for the next round or try another room.'
                    });
                } else if (errorMsg.toLowerCase().includes('duplicate') || errorMsg.toLowerCase().includes('name')) {
                    setModalState({
                        isOpen: true,
                        type: 'alert',
                        title: 'Name Taken',
                        message: 'Someone in this room already has that name. Please choose a different name.'
                    });
                } else {
                    setError(errorMsg);
                    setTimeout(() => setError(null), 3000);
                }
            }
        });
    };

    const handleLeaveRoom = () => {
        // Reset game store
        setRoom(null);
        setPlayer('', '');
        setMyQuestion(null);

        // Clear session
        clearSession();

        // Return to home
        setView('home');

        // Reconnect socket for next game
        if (socket && !socket.connected) {
            socket.connect();
        }
    };

    // Show reconnecting overlay
    if (isReconnecting) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-white mb-2">Reconnecting...</h2>
                    <p className="text-gray-400">Getting you back into the game</p>
                </div>
            </div>
        );
    }

    if (view === 'lobby') {
        if (room) {
            return <Lobby socket={socket} onLeaveRoom={handleLeaveRoom} />;
        }
        // Show loading while waiting for room data
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-white mb-2">Creating Room...</h2>
                    <p className="text-gray-400">Setting up your game</p>
                </div>
            </div>
        );
    }

    if (view === 'game') {
        if (room) {
            return <GameBoard socket={socket} />;
        }
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-white mb-2">Loading Game...</h2>
                </div>
            </div>
        );
    }

    if (view === 'reveal') {
        if (room) {
            return <RevealScreen socket={socket} onPlayAgain={() => setView('game')} />;
        }
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold text-white mb-2">Loading...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-2xl w-full relative z-10">
                {/* Hero Section */}
                <div className="text-center mb-12 animate-fadeIn">
                    <div className="flex items-center justify-center mb-6 relative">
                        <div className="absolute inset-0 blur-2xl opacity-50">
                            <Sparkles className="w-16 h-16 mx-auto text-indigo-500" />
                        </div>
                        <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse relative" />
                    </div>
                    <h1 className="text-7xl md:text-8xl font-black mb-6 gradient-text tracking-tight animate-title">
                        BlindLOL 😂
                    </h1>
                    <p className="text-2xl md:text-3xl font-bold text-white mb-3 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                        Create hilarious stories with friends
                    </p>
                    <p className="text-lg text-gray-400 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
                        Answer questions without seeing what others wrote!
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-fadeIn"
                        style={{ animationDelay: '0.6s' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all duration-300 pointer-events-none"></div>
                        <div className="relative flex flex-col items-center p-8 pointer-events-none">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-indigo-500/50 blur-xl rounded-full group-hover:blur-2xl transition-all"></div>
                                <Users className="w-14 h-14 text-indigo-300 group-hover:scale-110 group-hover:text-indigo-200 transition-all relative" />
                            </div>
                            <h3 className="text-3xl font-bold mb-2 text-white">Create Room</h3>
                            <p className="text-gray-300 text-base">Start a new game</p>
                        </div>
                    </button>

                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-fadeIn"
                        style={{ animationDelay: '0.8s' }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-rose-500/20 backdrop-blur-xl border border-white/10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-rose-500/0 group-hover:from-pink-500/30 group-hover:to-rose-500/30 transition-all duration-300 pointer-events-none"></div>
                        <div className="relative flex flex-col items-center p-8 pointer-events-none">
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-pink-500/50 blur-xl rounded-full group-hover:blur-2xl transition-all"></div>
                                <LogIn className="w-14 h-14 text-pink-300 group-hover:scale-110 group-hover:text-pink-200 transition-all relative" />
                            </div>
                            <h3 className="text-3xl font-bold mb-2 text-white">Join Room</h3>
                            <p className="text-gray-300 text-base">Enter a room code</p>
                        </div>
                    </button>
                </div>

                {/* How to Play */}
                <div className="relative rounded-3xl overflow-hidden animate-fadeIn" style={{ animationDelay: '1s' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-pink-500/10 backdrop-blur-xl border border-white/10"></div>
                    <div className="relative p-8">
                        <h3 className="text-2xl font-bold mb-8 text-center bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                            How to Play
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                            <div className="text-center group">
                                <div className="relative mb-3 mx-auto w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative text-4xl font-black bg-gradient-to-br from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
                                        1
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-gray-300">Answer "Who?"</p>
                            </div>
                            <div className="text-center group">
                                <div className="relative mb-3 mx-auto w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-purple-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative text-4xl font-black bg-gradient-to-br from-purple-400 to-purple-600 bg-clip-text text-transparent">
                                        2
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-gray-300">Answer "With whom?"</p>
                            </div>
                            <div className="text-center group">
                                <div className="relative mb-3 mx-auto w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative text-4xl font-black bg-gradient-to-br from-pink-400 to-pink-600 bg-clip-text text-transparent">
                                        3
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-gray-300">Answer "Where?"</p>
                            </div>
                            <div className="text-center group">
                                <div className="relative mb-3 mx-auto w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-rose-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                                    <div className="relative text-4xl font-black bg-gradient-to-br from-rose-400 to-rose-600 bg-clip-text text-transparent">
                                        4
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-gray-300">Answer "How?"</p>
                            </div>
                        </div>
                        <div className="text-center pt-4 border-t border-white/10">
                            <p className="text-gray-400 font-medium">
                                See the hilarious story revealed at the end!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Ad Banner */}
                <div className="mt-8 animate-fadeIn" style={{ animationDelay: '1.2s' }}>
                    <AdBanner
                        adSlot="1234567890"
                        adFormat="auto"
                        className="max-w-2xl mx-auto"
                    />
                </div>

                {/* Create Room Modal */}
                {showCreateModal && (
                    <CreateRoomModal
                        onClose={() => setShowCreateModal(false)}
                        onCreate={handleCreateRoom}
                    />
                )}

                {/* Join Room Modal */}
                {showJoinModal && (
                    <JoinRoomModal
                        onClose={() => setShowJoinModal(false)}
                        onJoin={handleJoinRoom}
                    />
                )}

                {/* Modal */}
                <Modal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState({ ...modalState, isOpen: false })}
                    title={modalState.title}
                    message={modalState.message}
                    type={modalState.type}
                />
            </div>
        </div>
    );
}

// Create Room Modal Component
function CreateRoomModal({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (name: string, settings: RoomSettings) => void;
}) {
    const [playerName, setPlayerName] = useState('');
    const [maxPlayers, setMaxPlayers] = useState(8);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim()) {
            onCreate(playerName, {
                maxPlayers,
                language: 'en',
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="relative max-w-md w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative glass rounded-3xl p-8 border-2 border-white/10">
                    <h2 className="text-4xl font-black mb-8 gradient-text text-center">Create Room</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold mb-3 text-gray-300">Your Name</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter your name"
                                className="input-field text-lg"
                                maxLength={20}
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-3 text-gray-300">
                                Max Players: <span className="text-indigo-400 text-xl font-bold">{maxPlayers}</span>
                            </label>
                            <input
                                type="range"
                                min="4"
                                max="12"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>4</span>
                                <span>12</span>
                            </div>
                        </div>

                        {/* Timer info */}
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                <span className="text-lg">⏱️</span>
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-gray-300 block">1 minute per answer</span>
                                <span className="text-xs text-gray-500">Keeps rounds fast and chaotic!</span>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-lg py-3">
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary flex-1 text-lg py-3 font-bold">
                                Create
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// Join Room Modal Component
function JoinRoomModal({
    onClose,
    onJoin,
}: {
    onClose: () => void;
    onJoin: (roomCode: string, playerName: string) => void;
}) {
    const [playerName, setPlayerName] = useState('');
    const [roomCode, setRoomCode] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim() && roomCode.trim()) {
            onJoin(roomCode.toUpperCase(), playerName);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="relative max-w-md w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-3xl blur-2xl"></div>
                <div className="relative glass rounded-3xl p-8 border-2 border-white/10">
                    <h2 className="text-4xl font-black mb-8 gradient-text text-center">Join Room</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold mb-3 text-gray-300">Your Name</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter your name"
                                className="input-field text-lg"
                                maxLength={20}
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-3 text-gray-300">Room Code</label>
                            <input
                                type="text"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                placeholder="XXXXXX"
                                className="input-field text-center text-4xl tracking-[0.5em] font-mono font-bold bg-gradient-to-br from-white/10 to-white/5"
                                maxLength={6}
                                required
                            />
                            <p className="text-xs text-gray-500 text-center mt-2">Enter the 6-character room code</p>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-lg py-3">
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary flex-1 text-lg py-3 font-bold">
                                Join
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
