/**
 * toAbc.ts — turn a note list into an ABC string for abcjs (PRD §8).
 *
 * WHY this file exists:
 *   Our source of truth is a list of {midi, startBeat, durBeats} notes. abcjs,
 *   however, reads "ABC notation" — a little text format for music. So this file
 *   is the translator. Because the SAME note list feeds both the picture (here)
 *   and the grader, the two can never drift apart (PRD §8).
 *
 * A 5-second tour of ABC notation:
 *   - Letters are pitches. Middle C (MIDI 60) is "C". The octave ABOVE it is
 *     lowercase "c". A comma lowers an octave ("C,"), an apostrophe raises one ("c'").
 *   - A sharp is "^" BEFORE the letter (^C), a flat is "_" (_D), natural is "=".
 *   - A number AFTER the note is its length, measured in "unit note lengths".
 *     We set the unit to an eighth note (L:1/8), so "C" = one eighth, "C2" = a
 *     quarter, "C4" = a half note.
 *   - "|" is a bar line.
 *   - The header lines (X, M, L, Q, K) set tune number, meter, unit length,
 *     tempo, and key.
 *
 * TRANSPOSITION (PRD §5): notes are stored in CONCERT pitch. We display WRITTEN
 * pitch for the player's instrument:  written = concert + writtenOffset.
 * Only the DISPLAY transposes; grading still compares concert pitch.
 */

import type { Exercise } from '../types';
import type { KeyId } from '../config';
import { INSTRUMENT_KEYS } from '../config';

// Chromatic scale spelled with sharps. Index = pitch class (midi % 12).
// e.g. 0 -> C, 1 -> C#, 2 -> D ...  In ABC a sharp is written "^".
const PITCH_CLASSES = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B'];

/** MIDI number -> one ABC note token, e.g. 60 -> "C", 72 -> "c", 61 -> "^C". */
function midiToAbcPitch(midi: number): string {
  const pitchClass = PITCH_CLASSES[midi % 12]; // letter (+ possible "^")
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 is C, which is octave 4

  // In ABC, octave 4 is UPPERCASE with no marks; octave 5 is lowercase.
  // Each octave below 4 adds a comma; each above 5 adds an apostrophe.
  if (octave >= 5) {
    // lowercase, plus one apostrophe per octave above 5
    const lower = pitchClass.toLowerCase();
    return lower + "'".repeat(octave - 5);
  }
  // uppercase (already), plus one comma per octave below 4
  return pitchClass + ','.repeat(4 - octave);
}

/**
 * Build the ABC string for one exercise, transposed to the instrument's written
 * pitch. Assumes quarter-note beats (time-signature denominator 4), which covers
 * all our MVP content.
 */
export function exerciseToAbc(exercise: Exercise, key: KeyId): string {
  const writtenOffset = INSTRUMENT_KEYS[key].writtenOffset;
  const [beatsPerBar, beatUnit] = exercise.timeSig;

  // Our unit note length is an eighth note (L:1/8). With quarter-note beats,
  // one beat = 2 eighths, so lengthInUnits = durBeats * 2.
  const body: string[] = [];
  let barBoundary = beatsPerBar; // next beat count where a bar line goes

  for (const note of exercise.notes) {
    // Insert a bar line once we've passed into a new measure.
    if (note.startBeat >= barBoundary) {
      body.push('|');
      barBoundary += beatsPerBar;
    }

    const pitch = midiToAbcPitch(note.midi + writtenOffset);
    const units = Math.round(note.durBeats * 2); // eighth-note units
    // "1" is redundant in ABC (a bare letter is already one unit), so omit it.
    body.push(units === 1 ? pitch : `${pitch}${units}`);
  }
  body.push('|]'); // final (thin-thick) bar line

  return [
    'X:1',
    `M:${beatsPerBar}/${beatUnit}`,
    'L:1/8',
    `Q:1/4=${exercise.tempo}`,
    'K:C',
    body.join(' '),
  ].join('\n');
}
