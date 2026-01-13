import { nanoid } from 'nanoid';

/**
 * Generate a unique room code
 * Uses 6 uppercase alphanumeric characters, excluding ambiguous ones (0, O, I, 1)
 */
export function generateRoomCode(): string {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    return nanoid(6).split('').map(() =>
        alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join('');
}
