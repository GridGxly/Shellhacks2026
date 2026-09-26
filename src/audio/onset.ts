/**
 * onset.ts — detecting when each note STARTS (PRD §6 "Onset detection").
 *
 * Two cases:
 *  - Pitch changes (chord, scale, ultimate): onset = when detected pitch switches.
 *  - Same pitch repeated (rhythm card): pitch can't separate notes, so detect a
 *    volume dip followed by a rise of at least ONSET_RMS_RISE. This is the
 *    RISKIEST part of the project (PRD §14) — build and test it early on a real
 *    instrument.
 *
 * TODO(team): implement both strategies.
 */

import type { PitchReading } from './pitch';

/** Returns the detected onset times (ms) from a stream of readings. */
export function detectOnsets(_readings: PitchReading[]): number[] {
  throw new Error('onset.ts not implemented — see PRD §6 & §14');
}
