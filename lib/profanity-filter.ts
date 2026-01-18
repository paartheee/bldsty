/**
 * Validate answer - basic validation only (no content moderation)
 */
export function validateAnswer(text: string): {
    isValid: boolean;
    cleanedText: string;
    error?: string;
} {
    if (!text || text.trim().length === 0) {
        return {
            isValid: false,
            cleanedText: '',
            error: 'Answer cannot be empty'
        };
    }

    if (text.length > 100) {
        return {
            isValid: false,
            cleanedText: text,
            error: 'Answer is too long (max 100 characters)'
        };
    }

    return {
        isValid: true,
        cleanedText: text.trim()
    };
}
