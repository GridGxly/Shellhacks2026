/**
 * clock.ts — the ONE shared clock (PRD §6 "One clock for everything").
 *
 * Count-in clicks, recording start, and beat 1 of the music must all be
 * scheduled on the same Web Audio clock (Tone.js Transport / audioContext
 * .currentTime) so the cursor, "what note should play now", and grading all
 * read a single `beat` value:  beat = (now - musicStartTime) * tempo / 60
 *
 * TODO(team): implement count-in scheduling and expose the current beat.
 */

export interface Clock {
  /** Current musical beat since beat 0 of the exercise (after the count-in). */
  currentBeat(): number;
}

// import * as Tone from 'tone';  // wire this up when implementing
export function createClock(_tempo: number): Clock {
  throw new Error('clock.ts not implemented — see PRD §6');
}
