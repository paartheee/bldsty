'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, RevealData } from '@/types/game';
import { motion } from 'framer-motion';
import { Sparkles, RotateCcw, Copy, Download } from 'lucide-react';

interface RevealScreenProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    onPlayAgain: () => void;
}

export default function RevealScreen({ socket, onPlayAgain }: RevealScreenProps) {
    const { room, isHost } = useGameStore();
    const [revealData, setRevealData] = useState<RevealData | null>(null);
    const [showSentence, setShowSentence] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (room && room.gameState.answers) {
            const { answers } = room.gameState;

            if (answers.who && answers.withWhom && answers.where && answers.how) {
                const who = answers.who.answer;
                const withWhom = answers.withWhom.answer;
                const where = answers.where.answer;
                const how = answers.how.answer;
                const sentence = `${who} was with ${withWhom} at ${where}, and they did it ${how}.`;

                setRevealData({ who, withWhom, where, how, sentence });

                // Dramatic reveal after 2 seconds
                setTimeout(() => setShowSentence(true), 2000);
            }
        }
    }, [room]);

    if (!room || !revealData) return null;

    const handleNewRound = () => {
        socket.emit('new-round');
        onPlayAgain();
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(revealData.sentence);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadAsImage = () => {
        // Create a simple text-based image
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(0.5, '#8b5cf6');
            gradient.addColorStop(1, '#ec4899');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Blind Story', canvas.width / 2, 100);

            ctx.font = '32px Inter, sans-serif';
            const words = revealData.sentence.split(' ');
            let line = '';
            let y = 250;

            words.forEach((word) => {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > canvas.width - 100 && line !== '') {
                    ctx.fillText(line, canvas.width / 2, y);
                    line = word + ' ';
                    y += 50;
                } else {
                    line = testLine;
                }
            });
            ctx.fillText(line, canvas.width / 2, y);

            // Download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'blind-story.png';
                    a.click();
                    URL.revokeObjectURL(url);
                }
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-12 animate-fadeIn">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-yellow-400 animate-bounce" />
                    <h2 className="text-5xl font-black gradient-text mb-2">The Story!</h2>
                    <p className="text-gray-400">Here's what you created together...</p>
                </div>

                {/* Countdown or Reveal */}
                {!showSentence ? (
                    <div className="glass rounded-2xl p-16 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="text-8xl font-black gradient-text animate-pulse">
                                3...
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Individual Answers */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {[
                                { label: 'Who?', answer: revealData.who, color: 'from-indigo-500 to-purple-500' },
                                { label: 'With whom?', answer: revealData.withWhom, color: 'from-purple-500 to-pink-500' },
                                { label: 'Where?', answer: revealData.where, color: 'from-pink-500 to-rose-500' },
                                { label: 'How?', answer: revealData.how, color: 'from-rose-500 to-orange-500' },
                            ].map((item, index) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.2, duration: 0.5 }}
                                    className="glass rounded-xl p-6"
                                >
                                    <div className="text-sm text-gray-400 mb-2">{item.label}</div>
                                    <div className={`text-2xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                                        {item.answer}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Full Sentence */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8, duration: 0.5 }}
                            className="glass rounded-2xl p-8 mb-8 glow"
                        >
                            <div className="text-center">
                                <div className="text-sm text-gray-400 mb-4">Complete Story</div>
                                <p className="text-3xl font-bold leading-relaxed">
                                    {revealData.sentence.split(' ').map((word, i) => (
                                        <motion.span
                                            key={i}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1 + i * 0.1 }}
                                            className="inline-block mr-2"
                                        >
                                            {word}
                                        </motion.span>
                                    ))}
                                </p>
                            </div>
                        </motion.div>

                        {/* Reactions */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2 }}
                            className="flex justify-center gap-4 mb-8"
                        >
                            {['😂', '🤣', '😆', '🔥'].map((emoji, i) => (
                                <button
                                    key={i}
                                    className="text-5xl hover:scale-125 transition-transform cursor-pointer"
                                    onClick={() => { }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </motion.div>

                        {/* Actions */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2.5 }}
                            className="flex flex-col sm:flex-row gap-4"
                        >
                            <button
                                onClick={copyToClipboard}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-5 h-5" />
                                        Copy Story
                                    </>
                                )}
                            </button>

                            <button
                                onClick={downloadAsImage}
                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                Download Image
                            </button>

                            {isHost() && (
                                <button
                                    onClick={handleNewRound}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                    Play Again
                                </button>
                            )}
                        </motion.div>

                        {!isHost() && (
                            <p className="text-center text-gray-400 mt-4 text-sm">
                                Waiting for host to start a new round...
                            </p>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function Check({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
            />
        </svg>
    );
}
