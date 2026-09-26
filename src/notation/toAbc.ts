/**
 * toAbc.ts — turn a note list into an ABC string for abcjs (PRD §8).
 *
 * The ABC string is GENERATED from the Exercise note list (transposed to WRITTEN
 * pitch for the chosen instrument) so display and grading can never drift apart.
 *   written = concert + INSTRUMENT_KEYS[key].writtenOffset  (semitones)
 *
 * TODO(team): map MIDI -> ABC note names, honor durBeats and the time signature.
 */

import type { Exercise } from '../types';
import type { KeyId } from '../config';

export function exerciseToAbc(_exercise: Exercise, _key: KeyId): string {
  throw new Error('toAbc.ts not implemented — see PRD §5 (transposition) & §8');
}
