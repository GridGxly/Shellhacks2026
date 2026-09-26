import { DUET_A, DUET_B, type Exercise } from './music';
import type { TavernMode, TavernPart } from './tavern-types';

/** Battle players read the exact same concert-pitch phrase and rhythm. */
export function tavernExercise(mode: TavernMode, part: TavernPart): Exercise {
  return mode === 'pvp' || part === 'A' ? DUET_A : DUET_B;
}

export function tavernDurationMs(mode: TavernMode = 'duet'): number {
  const exercise = tavernExercise(mode, 'A');
  return exercise.bars * exercise.beatsPerBar * 60_000 / exercise.tempo;
}
