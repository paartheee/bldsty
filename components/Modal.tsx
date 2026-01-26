'use client';

import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ModalType = 'confirm' | 'alert' | 'success' | 'error' | 'info';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title?: string;
    message: string;
    type?: ModalType;
    confirmText?: string;
    cancelText?: string;
}

export default function Modal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'confirm',
    confirmText = 'OK',
    cancelText = 'Cancel'
}: ModalProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-12 h-12 text-green-400" />;
            case 'error':
                return <AlertCircle className="w-12 h-12 text-red-400" />;
            case 'info':
                return <Info className="w-12 h-12 text-blue-400" />;
            default:
                return <AlertCircle className="w-12 h-12 text-yellow-400" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md animate-scaleIn">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-3xl blur-2xl" />

                {/* Modal content */}
                <div className="relative glass rounded-3xl border-2 border-white/20 p-6 md:p-8">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>

                    {/* Icon */}
                    <div className="flex justify-center mb-4">
                        {getIcon()}
                    </div>

                    {/* Title */}
                    {title && (
                        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 gradient-text">
                            {title}
                        </h2>
                    )}

                    {/* Message */}
                    <p className="text-base md:text-lg text-gray-300 text-center mb-6 md:mb-8">
                        {message}
                    </p>

                    {/* Buttons */}
                    <div className="flex gap-3 justify-center">
                        {type === 'confirm' && (
                            <button
                                onClick={onClose}
                                className="btn-secondary px-6 py-3 min-w-[100px] hover:bg-white/10"
                            >
                                <span className="font-semibold">{cancelText}</span>
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            className={`btn-primary px-6 py-3 min-w-[100px] ${type === 'error' ? 'bg-red-500 hover:bg-red-600' : ''
                                }`}
                        >
                            <span className="font-semibold">{confirmText}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
