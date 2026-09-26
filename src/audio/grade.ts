/**
 * grade.ts — per-note correct/wrong grading (PRD §6 "Per-note check").
 *
 * A note is CORRECT if both:
 *   1. Right pitch: detected pitch within PITCH_TOLERANCE_CENTS of the expected
 *      CONCERT note for at least MIN_PITCH_COVERAGE of the note's readings.
 *   2. Right time: onset within +/- TIMING_WINDOW_MS of the expected start.
 * Otherwise WRONG. Record the most common detected pitch for the ghost note,
 * or null if silent.
 *
 * A card passes if (correct / total) >= PASS_THRESHOLD (ULTIMATE_PASS_THRESHOLD
 * for the ultimate).
 *
 * TODO(team): implement using PitchReading[] + detected onsets vs the Exercise.
 */

import type { Exercise, NoteResult } from '../types';
import type { PitchReading } from './pitch';

export function gradeExercise(
  _exercise: Exercise,
  _readings: PitchReading[],
  _onsets: number[],
): NoteResult[] {
  throw new Error('grade.ts not implemented — see PRD §6');
}

/** Share of notes correct, 0..1. */
export function scoreOf(results: NoteResult[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter((r) => r.correct).length;
  return correct / results.length;
}
