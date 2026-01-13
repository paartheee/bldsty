'use client';

import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, QuestionType } from '@/types/game';
import { Send, Loader2 } from 'lucide-react';

interface GameBoardProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
}

function getQuestionLabel(question: QuestionType): string {
    const labels: Record<QuestionType, string> = {
        who: 'Who?',
        withWhom: 'With whom?',
        where: 'Where?',
        how: 'How?'
    };
    return labels[question];
}

export default function GameBoard({ socket }: GameBoardProps) {
    const { room, myQuestion, hasAnswered, isWaiting } = useGameStore();
    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!room || !myQuestion) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!answer.trim() || isSubmitting) return;

        setIsSubmitting(true);
        socket.emit('submit-answer', answer.trim());

        // Clear input after submission
        setTimeout(() => {
            setAnswer('');
            setIsSubmitting(false);
        }, 500);
    };

    const questionLabel = getQuestionLabel(myQuestion);
    const answeredCount = Object.keys(room.gameState.answers).length;
    const totalQuestions = 4;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed"></div>
            </div>

            <div className="max-w-2xl w-full relative z-10">
                {/* Round Info */}
                <div className="text-center mb-10 animate-fadeIn">
                    <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-4">
                        <span className="text-sm font-bold text-indigo-300">Round {room.gameState.currentRound}</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black gradient-text mb-6 animate-title">
                        {hasAnswered() ? '✓ Answer Submitted!' : questionLabel}
                    </h2>
                    {!hasAnswered() && (
                        <p className="text-xl text-gray-300 font-medium">
                            Be creative! Your answer will be revealed at the end.
                        </p>
                    )}
                </div>

                {/* Progress Indicators (without revealing which questions) */}
                <div className="flex justify-center gap-3 mb-10">
                    {Array.from({ length: totalQuestions }).map((_, i) => (
                        <div
                            key={i}
                            className={`relative h-3 w-20 rounded-full transition-all duration-500 ${i < answeredCount
                                ? 'bg-gradient-to-r from-indigo-500 to-pink-500'
                                : 'bg-gray-700/50'
                                }`}
                        >
                            {i < answeredCount && (
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full blur-md"></div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Answer Form or Waiting State */}
                {!hasAnswered() ? (
                    <div className="relative rounded-3xl overflow-hidden animate-fadeIn">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10"></div>
                        <form onSubmit={handleSubmit} className="relative p-8">
                            <div className="mb-6">
                                <label className="block text-sm font-bold mb-4 text-gray-300 uppercase tracking-wider">
                                    Your Answer
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="Type your answer here..."
                                        className="input-field resize-none h-40 text-xl font-medium"
                                        maxLength={100}
                                        autoFocus
                                        disabled={isSubmitting}
                                    />
                                    <div className="absolute bottom-4 right-4 text-sm font-semibold text-gray-500 bg-gray-900/50 px-3 py-1 rounded-lg">
                                        {answer.length}/100
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!answer.trim() || isSubmitting}
                                className={`relative w-full overflow-hidden rounded-2xl transition-all duration-300 ${!answer.trim() || isSubmitting
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30 group'
                                    }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                                {!isSubmitting && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                )}
                                <div className="relative px-8 py-5 font-black text-2xl text-white flex items-center justify-center gap-3">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-7 h-7 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-7 h-7" />
                                            Submit Answer
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="relative rounded-3xl overflow-hidden animate-fadeIn">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-500/20"></div>
                        <div className="relative p-12 text-center">
                            <div className="relative mx-auto mb-8 w-24 h-24">
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-2xl opacity-50"></div>
                                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                                    <Check className="w-12 h-12 text-white" />
                                </div>
                            </div>
                            <h3 className="text-4xl font-black mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                Great Job!
                            </h3>
                            <p className="text-gray-300 mb-8 text-lg font-medium">
                                Waiting for other players to submit their answers...
                            </p>

                            {/* Animated waiting dots */}
                            <div className="flex justify-center gap-3 mb-8">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 animate-bounce"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>

                            {/* Players status */}
                            <div className="pt-8 border-t border-white/10">
                                <div className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">
                                    Players Progress
                                </div>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {room.players.map((player) => (
                                        <div
                                            key={player.id}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${player.hasAnswered
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                : 'bg-gray-700/30 text-gray-400 border-gray-600/30'
                                                }`}
                                        >
                                            {player.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
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
