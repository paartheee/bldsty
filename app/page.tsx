'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, RoomSettings } from '@/types/game';
import Lobby from '@/components/Lobby';
import GameBoard from '@/components/GameBoard';
import RevealScreen from '@/components/RevealScreen';
import { Sparkles, Users, LogIn } from 'lucide-react';

let socket: Socket<ServerToClientEvents, ClientToServerEvents>;

export default function Home() {
    const [view, setView] = useState<'home' | 'lobby' | 'game' | 'reveal'>('home');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    const { setConnected, setPlayer, setRoom, setMyQuestion, setError, room } = useGameStore();

    useEffect(() => {
        // Initialize Socket.IO - connect to external server in production
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            console.log('Connected to server');
            setConnected(true);
            setPlayer(socket.id!, '');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnected(false);
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
            setError(message);
            setTimeout(() => setError(null), 3000);
        });

        socket.on('kicked', () => {
            setError('You were kicked from the room');
            setView('home');
            setTimeout(() => setError(null), 3000);
        });

        return () => {
            socket.disconnect();
        };
    }, [setConnected, setPlayer, setRoom, setMyQuestion, setError]);

    const handleCreateRoom = (playerName: string, settings: RoomSettings) => {
        socket.emit('create-room', playerName, settings, (roomCode) => {
            setShowCreateModal(false);
            setView('lobby');
        });
    };

    const handleJoinRoom = (roomCode: string, playerName: string) => {
        socket.emit('join-room', roomCode, playerName, (success, error) => {
            if (success) {
                setShowJoinModal(false);
                setView('lobby');
            } else {
                setError(error || 'Failed to join room');
                setTimeout(() => setError(null), 3000);
            }
        });
    };

    if (view === 'lobby' && room) {
        return <Lobby socket={socket} />;
    }

    if (view === 'game' && room) {
        return <GameBoard socket={socket} />;
    }

    if (view === 'reveal' && room) {
        return <RevealScreen socket={socket} onPlayAgain={() => setView('game')} />;
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
                        Blind Story
                    </h1>
                    <p className="text-2xl md:text-3xl font-bold text-white mb-3 animate-fadeIn" style={{animationDelay: '0.2s'}}>
                        Create hilarious stories with friends
                    </p>
                    <p className="text-lg text-gray-400 animate-fadeIn" style={{animationDelay: '0.4s'}}>
                        Answer questions without seeing what others wrote!
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-fadeIn"
                        style={{animationDelay: '0.6s'}}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all duration-300 pointer-events-none"></div>
                        <div className="relative flex flex-col items-center p-8">
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
                        style={{animationDelay: '0.8s'}}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-rose-500/20 backdrop-blur-xl border border-white/10 pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-rose-500/0 group-hover:from-pink-500/30 group-hover:to-rose-500/30 transition-all duration-300 pointer-events-none"></div>
                        <div className="relative flex flex-col items-center p-8">
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
                <div className="relative rounded-3xl overflow-hidden animate-fadeIn" style={{animationDelay: '1s'}}>
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
    const [moderationEnabled, setModerationEnabled] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (playerName.trim()) {
            onCreate(playerName, {
                maxPlayers,
                language: 'en',
                moderationEnabled,
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

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                            <label className="text-sm font-semibold text-gray-300">Content Moderation</label>
                            <button
                                type="button"
                                onClick={() => setModerationEnabled(!moderationEnabled)}
                                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${moderationEnabled ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gray-700'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-lg ${moderationEnabled ? 'left-7' : 'left-0.5'
                                        }`}
                                />
                            </button>
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
