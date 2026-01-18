'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/lib/game-store';
import type { ServerToClientEvents, ClientToServerEvents, QuestionType } from '@/types/game';
import { Send, Loader2, Clock } from 'lucide-react';

const TIMER_SECONDS = 60; // 1 minute per question

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
    const { room, myQuestion, hasAnswered } = useGameStore();
    const [answer, setAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const hasAutoSubmittedRef = useRef(false);

    // Auto-submit function
    const autoSubmit = useCallback(() => {
        if (hasAutoSubmittedRef.current || isSubmitting) return;
        hasAutoSubmittedRef.current = true;

        setIsSubmitting(true);
        // Submit "..." if no answer provided (skipped)
        const submittedAnswer = answer.trim() || '...';
        socket.emit('submit-answer', submittedAnswer);

        setTimeout(() => {
            setAnswer('');
            setIsSubmitting(false);
        }, 500);
    }, [answer, isSubmitting, socket]);

    // Timer effect - only runs when player hasn't answered
    useEffect(() => {
        // Reset timer when question changes or component mounts
        if (!hasAnswered()) {
            setTimeLeft(TIMER_SECONDS);
            hasAutoSubmittedRef.current = false;

            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        // Time's up - auto submit
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [myQuestion, hasAnswered]);

    // Auto-submit when timer reaches 0
    useEffect(() => {
        if (timeLeft === 0 && !hasAnswered() && !hasAutoSubmittedRef.current) {
            autoSubmit();
        }
    }, [timeLeft, hasAnswered, autoSubmit]);

    if (!room || !myQuestion) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!answer.trim() || isSubmitting) return;

        // Clear timer on manual submit
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

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

    // Timer colors based on time remaining
    const getTimerColor = () => {
        if (timeLeft <= 10) return 'from-red-500 to-rose-500';
        if (timeLeft <= 30) return 'from-yellow-500 to-orange-500';
        return 'from-indigo-500 to-purple-500';
    };

    const getTimerTextColor = () => {
        if (timeLeft <= 10) return 'text-red-400';
        if (timeLeft <= 30) return 'text-yellow-400';
        return 'text-indigo-400';
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-float-delayed"></div>
            </div>

            <div className="max-w-2xl w-full relative z-10">
                {/* Round Info */}
                <div className="text-center mb-6 md:mb-10 animate-fadeIn">
                    <div className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-4">
                        <span className="text-sm font-bold text-indigo-300">Round {room.gameState.currentRound}</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-black gradient-text mb-4 md:mb-6 animate-title">
                        {hasAnswered() ? '✓ Answer Submitted!' : questionLabel}
                    </h2>
                    {!hasAnswered() && (
                        <p className="text-base md:text-xl text-gray-300 font-medium px-4">
                            Be creative! Your answer will be revealed at the end.
                        </p>
                    )}
                </div>

                {/* Timer - Only visible when answering */}
                {!hasAnswered() && (
                    <div className="flex justify-center mb-6 md:mb-8 animate-fadeIn">
                        <div className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r ${getTimerColor()} bg-opacity-20 border border-white/10`}>
                            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-white/0 rounded-2xl"></div>
                            <Clock className={`w-6 h-6 md:w-7 md:h-7 ${getTimerTextColor()} ${timeLeft <= 10 ? 'animate-pulse' : ''}`} />
                            <span className={`text-3xl md:text-4xl font-black font-mono ${getTimerTextColor()} ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                                {String(Math.floor(timeLeft / 60)).padStart(1, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                            {timeLeft <= 10 && (
                                <span className="text-xs md:text-sm font-bold text-red-400 animate-pulse">HURRY!</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Progress Indicators (without revealing which questions) */}
                <div className="flex justify-center gap-2 md:gap-3 mb-6 md:mb-10">
                    {Array.from({ length: totalQuestions }).map((_, i) => (
                        <div
                            key={i}
                            className={`relative h-2 md:h-3 w-14 md:w-20 rounded-full transition-all duration-500 ${i < answeredCount
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

                {/* Answer Form or Waiting State - Mobile First */}
                {!hasAnswered() ? (
                    <div className="relative rounded-2xl md:rounded-3xl overflow-hidden animate-fadeIn">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10"></div>
                        <form onSubmit={handleSubmit} className="relative p-4 md:p-8">
                            <div className="mb-4 md:mb-6">
                                <label className="block text-xs md:text-sm font-bold mb-3 md:mb-4 text-gray-300 uppercase tracking-wider">
                                    Your Answer
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        placeholder="Type your answer here..."
                                        className="input-field resize-none h-32 md:h-40 text-lg md:text-xl font-medium"
                                        maxLength={100}
                                        autoFocus
                                        disabled={isSubmitting}
                                    />
                                    <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 text-xs md:text-sm font-semibold text-gray-500 bg-gray-900/50 px-2 md:px-3 py-1 rounded-lg">
                                        {answer.length}/100
                                    </div>
                                </div>
                            </div>

                            {/* Big thumb-friendly submit button */}
                            <button
                                type="submit"
                                disabled={!answer.trim() || isSubmitting}
                                className={`relative w-full overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 min-h-[60px] md:min-h-[72px] ${!answer.trim() || isSubmitting
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/30 active:scale-[0.98] group'
                                    }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                                {!isSubmitting && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                )}
                                <div className="relative px-6 py-4 md:px-8 md:py-5 font-black text-xl md:text-2xl text-white flex items-center justify-center gap-2 md:gap-3">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-6 h-6 md:w-7 md:h-7" />
                                            Submit Answer
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="relative rounded-2xl md:rounded-3xl overflow-hidden animate-fadeIn">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-500/20"></div>
                        <div className="relative p-6 md:p-12 text-center">
                            <div className="relative mx-auto mb-6 md:mb-8 w-16 h-16 md:w-24 md:h-24">
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-2xl opacity-50"></div>
                                <div className="relative w-16 h-16 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                                    <Check className="w-8 h-8 md:w-12 md:h-12 text-white" />
                                </div>
                            </div>
                            <h3 className="text-2xl md:text-4xl font-black mb-3 md:mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                Great Job!
                            </h3>
                            <p className="text-gray-300 mb-6 md:mb-8 text-base md:text-lg font-medium px-4">
                                Waiting for other players to submit their answers...
                            </p>

                            {/* Animated waiting dots */}
                            <div className="flex justify-center gap-2 md:gap-3 mb-6 md:mb-8">
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={i}
                                        className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 animate-bounce"
                                        style={{ animationDelay: `${i * 0.2}s` }}
                                    />
                                ))}
                            </div>

                            {/* Players status */}
                            <div className="pt-6 md:pt-8 border-t border-white/10">
                                <div className="text-xs md:text-sm font-bold text-gray-400 mb-3 md:mb-4 uppercase tracking-wider">
                                    Players Progress
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                                    {room.players.map((player) => (
                                        <div
                                            key={player.id}
                                            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold border transition-all ${player.hasAnswered
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
