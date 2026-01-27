'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, RevealData, QuestionType } from '@/types/game';
import { motion } from 'framer-motion';
import { Sparkles, RotateCcw, Users } from 'lucide-react';
import AdBanner from './AdBanner';

interface RevealScreenProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    onPlayAgain: () => void;
}

export default function RevealScreen({ socket, onPlayAgain }: RevealScreenProps) {
    const { room, isHost } = useGameStore();
    const [revealData, setRevealData] = useState<RevealData | null>(null);
    const [showSentence, setShowSentence] = useState(false);

    // Get player name by question type
    const getPlayerNameByQuestion = (questionType: QuestionType): string => {
        if (!room) return '';
        const player = room.players.find(p => p.assignedQuestion === questionType);
        return player?.name || 'Unknown';
    };

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

    return (
        <div className="min-h-screen flex items-start md:items-center justify-start md:justify-center p-2 md:p-4 pt-4 md:pt-4">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-8 md:mb-12 animate-fadeIn">
                    <Sparkles className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-yellow-400 animate-bounce" />
                    <h2 className="text-4xl md:text-5xl font-black gradient-text mb-2">The Story!</h2>
                    <p className="text-sm md:text-base text-gray-400">Here&apos;s what you created together...</p>
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
                        {/* Individual Answers with Player Names */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                            {[
                                { label: 'Who?', answer: revealData.who, color: 'from-indigo-500 to-purple-500', questionType: 'who' as QuestionType },
                                { label: 'With whom?', answer: revealData.withWhom, color: 'from-purple-500 to-pink-500', questionType: 'withWhom' as QuestionType },
                                { label: 'Where?', answer: revealData.where, color: 'from-pink-500 to-rose-500', questionType: 'where' as QuestionType },
                                { label: 'How?', answer: revealData.how, color: 'from-rose-500 to-orange-500', questionType: 'how' as QuestionType },
                            ].map((item, index) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.2, duration: 0.5 }}
                                    className="glass rounded-xl md:rounded-2xl p-4 md:p-6"
                                >
                                    <div className="flex items-center justify-between mb-2 md:mb-3">
                                        <span className="text-xs md:text-sm text-gray-400">{item.label}</span>
                                        <span className={`text-xs md:text-sm font-semibold px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-gradient-to-r ${item.color} bg-opacity-20 text-white`}>
                                            {getPlayerNameByQuestion(item.questionType)}
                                        </span>
                                    </div>
                                    <div className={`text-xl md:text-2xl font-bold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
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
                            className="glass rounded-xl md:rounded-2xl p-4 md:p-8 mb-6 md:mb-8 glow"
                        >
                            <div className="text-center">
                                <div className="text-xs md:text-sm text-gray-400 mb-3 md:mb-4">Complete Story</div>
                                <p className="text-xl md:text-3xl font-bold leading-relaxed">
                                    {revealData.sentence.split(' ').map((word, i) => (
                                        <motion.span
                                            key={i}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1 + i * 0.1 }}
                                            className="inline-block mr-1.5 md:mr-2"
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
                            className="flex justify-center gap-3 md:gap-4 mb-6 md:mb-8"
                        >
                            {['🔥', '😜', '🤣', '😂', '🔥'].map((emoji, i) => (
                                <button
                                    key={i}
                                    className="text-4xl md:text-5xl hover:scale-125 transition-transform cursor-pointer active:scale-90"
                                    onClick={() => { }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </motion.div>

                        {/* Ad Banner */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2.2 }}
                            className="mb-6 md:mb-8"
                        >
                            <AdBanner
                                adSlot="1234567892"
                                adFormat="auto"
                            />
                        </motion.div>

                        {/* Actions */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2.5 }}
                            className="flex justify-center gap-4"
                        >
                            {isHost() ? (
                                <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-center">
                                    <button
                                        onClick={handleNewRound}
                                        className="btn-primary px-6 md:px-8 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-3 text-lg md:text-xl font-bold"
                                    >
                                        <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
                                        Play Again
                                    </button>
                                    <button
                                        onClick={() => socket.emit('reset-to-lobby', {})}
                                        className="btn-secondary px-6 md:px-8 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-3 text-lg md:text-xl font-bold"
                                    >
                                        <Users className="w-5 h-5 md:w-6 md:h-6" />
                                        Add / Remove Players
                                    </button>
                                </div>
                            ) : (
                                <div className="glass rounded-xl md:rounded-2xl px-6 py-4 md:px-8 md:py-5">
                                    <p className="text-center text-gray-300 text-sm md:text-base font-medium">
                                        Waiting for host to start a new round...
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
