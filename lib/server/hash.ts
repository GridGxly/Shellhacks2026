import { createHash } from 'node:crypto';

/** Hex SHA-256 of a string or bytes (session and tavern tokens are stored only as this). */
export const sha256Hex = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
