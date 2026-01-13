// Simple profanity filter without external dependencies
const badWords = [
    'fuck', 'shit', 'ass', 'bitch', 'damn', 'hell', 'crap',
    // Add more as needed
];

/**
 * Check if text contains profanity
 */
export function containsProfanity(text: string): boolean {
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

/**
 * Clean profanity from text
 */
export function cleanText(text: string): string {
    let cleaned = text;
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        cleaned = cleaned.replace(regex, '*'.repeat(word.length));
    });
    return cleaned;
}

/**
 * Validate and optionally clean text based on moderation settings
 */
export function validateAnswer(text: string, moderationEnabled: boolean): {
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

    if (moderationEnabled && containsProfanity(text)) {
        return {
            isValid: false,
            cleanedText: cleanText(text),
            error: 'Please keep it friendly!'
        };
    }

    return {
        isValid: true,
        cleanedText: text.trim()
    };
}
