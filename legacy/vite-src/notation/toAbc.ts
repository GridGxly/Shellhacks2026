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
export function midiToAbcPitch(midi: number): string {
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

// Bars per staff line, so long pieces wrap instead of squeezing onto one line.
const MEASURES_PER_LINE = 4;

/**
 * The exercise's rhythm as ABC lines (MEASURES_PER_LINE bars each). `pitchAt(i)`
 * gives the CONCERT MIDI to print for note i, or null to print an invisible rest
 * ("x") of the same length — so every voice built this way lines up
 * note-for-note and line-for-line.
 */
function buildVoiceLines(
  exercise: Exercise,
  writtenOffset: number,
  pitchAt: (i: number) => number | null,
): string[] {
  const beatsPerBar = exercise.timeSig[0];
  // Our unit note length is an eighth note (L:1/8). With quarter-note beats,
  // one beat = 2 eighths, so lengthInUnits = durBeats * 2.
  const measures: string[][] = [[]];
  let barBoundary = beatsPerBar; // beat count where the next measure starts

  exercise.notes.forEach((note, i) => {
    while (note.startBeat >= barBoundary) {
      measures.push([]);
      barBoundary += beatsPerBar;
    }
    const midi = pitchAt(i);
    const token = midi == null ? 'x' : midiToAbcPitch(midi + writtenOffset);
    const units = Math.round(note.durBeats * 2); // eighth-note units
    // "1" is redundant in ABC (a bare letter is already one unit), so omit it.
    measures[measures.length - 1].push(units === 1 ? token : `${token}${units}`);
  });

  // Close each measure with a bar line; the last gets the final "|]".
  const bars = measures.map((m, idx) => `${m.join(' ')} ${idx === measures.length - 1 ? '|]' : '|'}`);
  const lines: string[] = [];
  for (let k = 0; k < bars.length; k += MEASURES_PER_LINE) {
    lines.push(bars.slice(k, k + MEASURES_PER_LINE).join(' '));
  }
  return lines;
}

/**
 * Build the ABC string for one exercise, transposed to the instrument's written
 * pitch. Assumes quarter-note beats (time-signature denominator 4), which covers
 * all our MVP content.
 *
 * Pass `ghosts` (one entry per note: the concert MIDI actually played, or null)
 * to add a SECOND VOICE on the same staff showing what the player really played.
 * abcjs positions those ghost notes itself — line/space, accidentals, ledger
 * lines — so no pixel math is needed anywhere. In the SVG, the written notes are
 * `.abcjs-v0` and the ghosts are `.abcjs-v1`.
 */
export function exerciseToAbc(
  exercise: Exercise,
  key: KeyId,
  ghosts?: (number | null)[],
): string {
  const writtenOffset = INSTRUMENT_KEYS[key].writtenOffset;
  const [beatsPerBar, beatUnit] = exercise.timeSig;
  const main = buildVoiceLines(exercise, writtenOffset, (i) => exercise.notes[i].midi);

  const header = [
    'X:1',
    `M:${beatsPerBar}/${beatUnit}`,
    'L:1/8',
    `Q:1/4=${exercise.tempo}`,
  ];

  if (!ghosts) return [...header, 'K:C', ...main].join('\n');

  // Interleave the voices line by line ([V:1] line, [V:2] line, ...) — the
  // standard ABC layout that keeps both voices on the same staff systems.
  const ghostLines = buildVoiceLines(exercise, writtenOffset, (i) => ghosts[i] ?? null);
  const body = main.flatMap((line, k) => [`[V:1] ${line}`, `[V:2] ${ghostLines[k]}`]);
  return [
    ...header,
    '%%score (1 2)', // both voices share one staff
    'V:1',
    'V:2',
    'K:C',
    ...body,
  ].join('\n');
}
