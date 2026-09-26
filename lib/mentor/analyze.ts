// Band-director feedback from a graded take — pure code, no AI. Reads what
// actually happened (wrong pitch vs. timing vs. silence, and where) and says
// the one or two things that matter, plus which card to practise next.

import { PERFECT_MS } from '../config';
import type { NoteResult } from '../mic';
import { CONCERT_KEY_PC, keySigFor, noteName, type Exercise } from '../music';
import type { CardKind } from '../compose/exercises';

export interface Feedback {
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  hits: number;
  total: number;
  lines: string[]; // what the director says, most important first
  next: CardKind | 'again' | 'faster' | null; // suggested follow-up
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/**
 * `shift` = the instrument's octave shift (grading compares against midi + shift, and
 * playedMidi is on that scale); `writtenOffset` turns sounding pitch into what's read.
 */
export function analyzeTake(ex: Exercise, results: NoteResult[], inst: { shift: number; writtenOffset: number } = { shift: 0, writtenOffset: 0 }): Feedback {
  const { shift, writtenOffset } = inst;
  const keyPc = ex.keyPc ?? CONCERT_KEY_PC;
  const key = keySigFor(keyPc, writtenOffset);
  const inKey = (m: number) => MAJOR.includes((((m - keyPc) % 12) + 12) % 12);
  const name = (sounding: number) => noteName(sounding + writtenOffset, key); // what the player reads
  const expected = (i: number) => ex.notes[i].midi + shift;
  const barOf = (i: number) => Math.floor(ex.notes[i].startBeat / ex.beatsPerBar) + 1;
  // Say it like a musician: beat 3.5 is "the & of 3".
  const beatOf = (i: number) => {
    const b = (ex.notes[i].startBeat % ex.beatsPerBar) + 1;
    return Number.isInteger(b) ? `beat ${b}` : `the & of ${Math.floor(b)}`;
  };
  const where = (i: number) => (ex.bars > 1 ? `bar ${barOf(i)}, ${beatOf(i)}` : beatOf(i));

  const total = results.length;
  const hits = results.filter((r) => r.status === 'hit').length;
  const silent = results.filter((r) => r.status === 'silent').length;
  const wrong = results.map((r, i) => ({ r, i })).filter(({ r }) => r.status === 'wrong' && r.playedMidi !== null);

  // Wrong notes, sorted into kinds a teacher would name differently.
  const keySlips = wrong.filter(({ r, i }) => {
    const exp = expected(i), got = r.playedMidi!;
    return Math.abs(got - exp) === 1 && inKey(exp) !== inKey(got); // right letter, wrong sharp/flat
  });
  const misreads = wrong.filter((w) => !keySlips.includes(w));

  // Timing, from notes whose pitch was right and whose attack we found.
  const offs = results.filter((r) => r.status === 'hit' && r.onsetOffsetMs !== null).map((r) => r.onsetOffsetMs!);
  const mean = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
  const offBeat = offs.filter((o) => Math.abs(o) > PERFECT_MS).length;

  // Worst bar: most non-hits.
  const misses = new Map<number, number>();
  results.forEach((r, i) => { if (r.status !== 'hit') misses.set(barOf(i), (misses.get(barOf(i)) ?? 0) + 1); });
  const worstBar = [...misses.entries()].sort((a, b) => b[1] - a[1])[0];

  const lines: string[] = [];
  let next: Feedback['next'] = null;

  if (total && silent / total >= 0.3) {
    lines.push(`I couldn't hear ${silent} of ${total} notes. Get closer to the mic and play out — full sound.`);
    next = 'again';
  }
  if (keySlips.length) {
    const { r, i } = keySlips[0];
    lines.push(`${where(i)}: you played ${name(r.playedMidi!)}, it's ${name(expected(i))}. ${inKey(expected(i)) ? 'Check the key signature.' : 'Watch that accidental.'}${keySlips.length > 1 ? ` Same slip ${keySlips.length - 1} more time${keySlips.length > 2 ? 's' : ''}.` : ''}`);
    next ??= 'scale';
  }
  if (misreads.length) {
    const { r, i } = misreads[0];
    lines.push(`${where(i)}: that's a ${name(expected(i))} — you gave me ${name(r.playedMidi!)}.${misreads.length > 1 ? ` ${misreads.length} wrong notes total; slow down and read ahead.` : ''}`);
    next ??= 'notes';
  }
  if (offs.length >= 3 && Math.abs(mean) > PERFECT_MS) {
    lines.push(mean < 0 ? `You're rushing — about ${Math.round(-mean)} ms ahead of the beat. Breathe, let the click come to you.` : `You're dragging — about ${Math.round(mean)} ms behind. Stay on top of the beat.`);
    next ??= 'rhythm';
  } else if (offs.length >= 3 && offBeat / offs.length > 0.4) {
    lines.push(`Right notes, but ${offBeat} of ${offs.length} landed off the beat. Lock in the rhythm.`);
    next ??= 'rhythm';
  }
  if (!lines.length && worstBar && ex.bars > 1) lines.push(`Clean except bar ${worstBar[0]} — from the top of ${worstBar[0]}.`);

  const acc = total ? hits / total : 0;
  const tight = offs.length ? offs.filter((o) => Math.abs(o) <= PERFECT_MS).length / offs.length : 1;
  const grade = acc === 1 && tight >= 0.8 ? 'S' : acc >= 0.9 ? 'A' : acc >= 0.75 ? 'B' : acc >= 0.5 ? 'C' : 'D';
  if (!lines.length) lines.push(grade === 'S' ? 'Perfect. Every note, right on time. Take it up a notch.' : 'Good. Right notes — now make it feel easy.');
  if (grade === 'S' || (grade === 'A' && !next)) next = 'faster';
  return { grade, hits, total, lines: lines.slice(0, 2), next };
}
