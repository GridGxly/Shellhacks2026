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

import type { Exercise, Level } from '../types';

/**
 * The main song: the famous 12-bar phrase from Francisco Tárrega's "Gran Vals"
 * (1902) — best known as the Nokia ringtone. Public domain.
 *
 * Transcribed from a piano-arrangement image, treble clef only (the melody
 * line; the bass-clef chords are intentionally dropped — PRD says "not true
 * chords, one note at a time"). Key: A major. Time: 3/4. Concert pitch.
 *
 * The 4-bar phrase (G#5-E5-A4-C#5 / D5-C#5-E4-G#4 / C#5-B4-D4-F#4 / A4 held)
 * repeats 3x = 12 bars, 36 beats.
 *
 * Tempo 200 BPM is taken from the ABC-notation source for this same phrase
 * (Henrik Norbeck's ABC collection, "Bars 13-16 from Gran Vals", Q:1/4=200).
 * At 200 BPM this exercise runs 36 beats * (60000/200)/1000 = 10.8s.
 * NOTE: startBeat/durBeats are the stored source of truth (PRD §6 "one clock
 * for everything" — real-time ms is derived at playback from tempo, not
 * baked into content). For reference, at this tempo 1 beat = 300ms, so
 * e.g. the first G#5 lands at 0ms, the first A4 at 300ms, bar 2 starts at
 * 900ms, bar 5 (the repeat) starts at 3600ms, and the piece ends at 10800ms.
 */
const GRAN_VALS_PHRASE: Array<{ midi: number; durBeats: number }> = [
  { midi: 80, durBeats: 0.5 }, // G#5
  { midi: 76, durBeats: 0.5 }, // E5
  { midi: 69, durBeats: 1 }, // A4
  { midi: 73, durBeats: 1 }, // C#5
  { midi: 74, durBeats: 0.5 }, // D5
  { midi: 73, durBeats: 0.5 }, // C#5
  { midi: 64, durBeats: 1 }, // E4
  { midi: 68, durBeats: 1 }, // G#4
  { midi: 73, durBeats: 0.5 }, // C#5
  { midi: 71, durBeats: 0.5 }, // B4
  { midi: 62, durBeats: 1 }, // D4
  { midi: 66, durBeats: 1 }, // F#4
  { midi: 69, durBeats: 3 }, // A4, held (fermata) through the bar
];

function repeatPhrase(times: number): Exercise['notes'] {
  const notes: Exercise['notes'] = [];
  let beat = 0;
  for (let i = 0; i < times; i += 1) {
    for (const { midi, durBeats } of GRAN_VALS_PHRASE) {
      notes.push({ midi, startBeat: beat, durBeats });
      beat += durBeats;
    }
  }
  return notes;
}

export const GRAN_VALS_ULTIMATE: Exercise = {
  id: 'gran-vals-ultimate',
  tempo: 200,
  timeSig: [3, 4],
  notes: repeatPhrase(3), // 3x 4-bar phrase = 12 bars, 36 beats
};

export const LEVELS: Level[] = [
  // TODO: nodes 1 & 2 need chord/scale/rhythm pools (PRD §5, MIN_POOL_SIZE each).
  {
    nodeId: 'node-3-boss',
    pools: { chord: [], scale: [], rhythm: [] },
    ultimate: GRAN_VALS_ULTIMATE,
  },
];
