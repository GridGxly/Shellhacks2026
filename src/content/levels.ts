/**
 * levels.ts — the game's music content (PRD §5, §8).
 *
 * Each Level (map node) has a pool of Exercises per card type (chord/scale/
 * rhythm), at least MIN_POOL_SIZE each, so a fresh exercise can be drawn every
 * round without repeating. The boss level also has `ultimate`: an excerpt of the
 * main song.
 *
 * All notes are stored in CONCERT pitch (see types.ts / PRD §5). Keep exercises
 * short (BARS_PER_CARD bars). One public-domain main song for the whole run.
 *
 * TODO(team): author the exercise pools. Start with a couple so the fight loop
 * can be tested, then expand.
 */

import type { Level } from '../types';

export const LEVELS: Level[] = [
  // TODO: { nodeId: 'node-1', pools: { chord: [...], scale: [...], rhythm: [...] } },
];
