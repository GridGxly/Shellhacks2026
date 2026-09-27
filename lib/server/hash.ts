import { createHash } from 'node:crypto';

/** Hex SHA-256 of a string (session and tavern tokens are stored only as this). */
export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
