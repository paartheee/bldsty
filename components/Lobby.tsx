'use client';

import { Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/game';
import { Users, Crown, Copy, Check, UserMinus } from 'lucide-react';
import { useState } from 'react';

interface LobbyProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
}

export default function Lobby({ socket }: LobbyProps) {
    const { room, isHost } = useGameStore();
    const [copied, setCopied] = useState(false);

    if (!room) return null;

    const handleStartGame = () => {
        if (room.players.length < 4) {
            alert('Need at least 4 players to start!');
            return;
        }
        socket.emit('start-game');
    };

    const handleKickPlayer = (playerId: string) => {
        if (confirm('Kick this player?')) {
            socket.emit('kick-player', playerId);
        }
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(room.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed"></div>
            </div>

            <div className="max-w-4xl w-full relative z-10">
                {/* Room Code Section */}
                <div className="text-center mb-8 md:mb-10 animate-fadeIn">
                    <h2 className="text-base md:text-xl font-bold mb-4 md:mb-6 text-gray-400 uppercase tracking-wider">Room Code</h2>
                    <div className="relative group inline-block">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-2xl md:rounded-3xl blur-2xl group-hover:blur-3xl transition-all"></div>
                        <div className="relative glass rounded-2xl md:rounded-3xl px-4 py-3 sm:px-6 sm:py-4 md:px-10 md:py-6 border-2 border-white/20 flex items-center gap-3 sm:gap-4">
                            <div className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-wide sm:tracking-wider md:tracking-widest gradient-text font-mono">
                                {room.code}
                            </div>
                            <button
                                onClick={copyRoomCode}
                                className="btn-secondary p-2 md:p-3 rounded-xl hover:scale-110 transition-all shrink-0"
                                title="Copy room code"
                            >
                                {copied ? (
                                    <Check className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                                ) : (
                                    <Copy className="w-5 h-5 md:w-6 md:h-6" />
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-gray-400 mt-4 md:mt-6 text-sm md:text-lg font-medium">Share this code with your friends!</p>
                </div>

                {/* Players Section */}
                <div className="relative rounded-2xl md:rounded-3xl overflow-hidden mb-6 md:mb-8 animate-fadeIn" style={{animationDelay: '0.2s'}}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10"></div>
                    <div className="relative p-4 md:p-8">
                        <div className="flex items-center justify-between mb-4 md:mb-8 gap-2">
                            <div className="flex items-center gap-2 md:gap-4">
                                <div className="p-2 md:p-3 bg-indigo-500/20 rounded-xl md:rounded-2xl">
                                    <Users className="w-5 h-5 md:w-7 md:h-7 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-3xl font-bold">
                                        Players
                                    </h3>
                                    <p className="text-gray-400 text-xs md:text-sm">
                                        {room.players.length} of {room.settings.maxPlayers} joined
                                    </p>
                                </div>
                            </div>
                            {room.players.length < 4 && (
                                <div className="px-2 py-1 md:px-4 md:py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg md:rounded-xl shrink-0">
                                    <span className="text-xs md:text-sm font-semibold text-yellow-300">
                                        Need {4 - room.players.length} more
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {room.players.map((player, index) => (
                                <div
                                    key={player.id}
                                    className="relative group animate-slideIn"
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 rounded-xl md:rounded-2xl group-hover:from-white/10 group-hover:to-white/5 transition-all"></div>
                                    <div className="relative rounded-xl md:rounded-2xl p-3 md:p-5 flex items-center justify-between border border-white/5 backdrop-blur-sm">
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-full blur-md opacity-50"></div>
                                                <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-base md:text-xl font-black shadow-lg">
                                                    {player.name.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                                                    <span className="font-bold text-base md:text-lg text-white">{player.name}</span>
                                                    {player.isHost && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 md:px-2 bg-yellow-500/20 rounded-full">
                                                            <Crown className="w-3 h-3 md:w-3.5 md:h-3.5 text-yellow-400" />
                                                            <span className="text-[10px] md:text-xs font-semibold text-yellow-300">Host</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isHost() && !player.isHost && (
                                            <button
                                                onClick={() => handleKickPlayer(player.id)}
                                                className="p-2 md:p-2.5 hover:bg-red-500/30 bg-red-500/10 rounded-lg md:rounded-xl transition-all border border-red-500/20 hover:border-red-500/40"
                                                title="Kick player"
                                            >
                                                <UserMinus className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Game Info */}
                <div className="relative rounded-xl md:rounded-2xl overflow-hidden mb-6 md:mb-8 animate-fadeIn" style={{animationDelay: '0.4s'}}>
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 backdrop-blur-xl border border-white/5"></div>
                    <div className="relative p-4 md:p-6">
                        <h4 className="font-bold mb-3 md:mb-4 text-base md:text-lg text-gray-300">Game Settings</h4>
                        <div className="grid grid-cols-2 gap-4 md:gap-6">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <span className="text-[10px] md:text-xs text-gray-500 block">Max Players</span>
                                    <span className="font-bold text-white text-base md:text-lg">{room.settings.maxPlayers}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-sm md:text-lg">🛡️</span>
                                </div>
                                <div>
                                    <span className="text-[10px] md:text-xs text-gray-500 block">Moderation</span>
                                    <span className="font-bold text-white text-base md:text-lg">
                                        {room.settings.moderationEnabled ? 'On' : 'Off'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Start Button */}
                {isHost() && (
                    <button
                        onClick={handleStartGame}
                        disabled={room.players.length < 4}
                        className={`relative w-full overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 group ${
                            room.players.length < 4
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30'
                        }`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                        {room.players.length >= 4 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        )}
                        <div className="relative px-6 py-4 md:px-8 md:py-5 font-black text-lg md:text-2xl text-white">
                            {room.players.length < 4 ? 'Waiting for Players...' : 'Start Game 🚀'}
                        </div>
                    </button>
                )}

                {!isHost() && (
                    <div className="relative rounded-xl md:rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10 animate-pulse"></div>
                        <div className="relative text-center py-4 md:py-6 px-4">
                            <p className="text-base md:text-xl font-semibold text-gray-300">
                                Waiting for host to start the game...
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
