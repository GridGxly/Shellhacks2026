// Strengths & weaknesses, measured rather than guessed. Every note is tagged by
// what makes it hard to read; after a take each tag counts hits / attempts.
// The Director only ever sees the summary of these counters.

import { PERFECT_MS } from '../config';
import type { NoteResult } from '../mic';
import { CONCERT_KEY_PC, type Exercise } from '../music';

export type Tag = 'dotted' | 'eighths' | 'accidental' | 'leap' | 'offbeat' | 'timing';
export const TAGS: Tag[] = ['dotted', 'eighths', 'accidental', 'leap', 'offbeat', 'timing'];

export const TAG_LABEL: Record<Tag, string> = {
  dotted: 'dotted rhythms',
  eighths: 'eighth notes',
  accidental: 'accidentals',
  leap: 'big leaps',
  offbeat: 'off-beat entrances',
  timing: 'playing in time',
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LEAP_SEMITONES = 5; // bigger than a major 3rd

/** Difficulty features of note i. ('timing' is counted per take, not per note.) */
export function noteTags(ex: Exercise, i: number): Tag[] {
  const n = ex.notes[i];
  const prev = ex.notes[i - 1];
  const keyPc = ex.keyPc ?? CONCERT_KEY_PC;
  const tags: Tag[] = [];
  // A dotted note and the short note that completes its beat are read as one figure.
  if (n.durBeats === 1.5 || n.durBeats === 3 || (prev && prev.durBeats === 1.5 && n.durBeats === 0.5)) tags.push('dotted');
  if (n.durBeats === 0.5) tags.push('eighths');
  if (!MAJOR.includes((((n.midi - keyPc) % 12) + 12) % 12)) tags.push('accidental');
  if (prev && Math.abs(n.midi - prev.midi) >= LEAP_SEMITONES) tags.push('leap');
  if (n.startBeat % 1 !== 0) tags.push('offbeat');
  return tags;
}

export type Counter = { hit: number; total: number };
export type Profile = Record<Tag, Counter>;

export const emptyProfile = (): Profile => Object.fromEntries(TAGS.map((t) => [t, { hit: 0, total: 0 }])) as Profile;

/** What one graded take adds to the profile. */
export function tally(ex: Exercise, results: NoteResult[]): Profile {
  const d = emptyProfile();
  results.forEach((r, i) => {
    if (!ex.notes[i]) return;
    const hit = r.status === 'hit' ? 1 : 0;
    for (const t of noteTags(ex, i)) {
      d[t].total++;
      d[t].hit += hit;
    }
    // Timing only counts where the pitch was right and an attack was found.
    if (r.status === 'hit' && r.onsetOffsetMs !== null) {
      d.timing.total++;
      if (Math.abs(r.onsetOffsetMs) <= PERFECT_MS) d.timing.hit++;
    }
  });
  return d;
}

export function addProfiles(a: Profile, b: Profile): Profile {
  const out = emptyProfile();
  for (const t of TAGS) out[t] = { hit: (a[t]?.hit ?? 0) + (b[t]?.hit ?? 0), total: (a[t]?.total ?? 0) + (b[t]?.total ?? 0) };
  return out;
}

const MIN_ATTEMPTS = 6; // fewer than this and a rate means nothing yet
const STRONG = 0.85;
const WEAK = 0.7;

export interface Summary {
  strengths: { tag: Tag; rate: number }[];
  weaknesses: { tag: Tag; rate: number }[];
}

/** Top-2 strengths and weaknesses — the only thing the Director is told. */
export function summarize(p: Profile): Summary {
  const rated = TAGS.filter((t) => p[t].total >= MIN_ATTEMPTS).map((tag) => ({ tag, rate: p[tag].hit / p[tag].total }));
  return {
    strengths: rated.filter((r) => r.rate >= STRONG).sort((a, b) => b.rate - a.rate).slice(0, 2),
    weaknesses: rated.filter((r) => r.rate < WEAK).sort((a, b) => a.rate - b.rate).slice(0, 2),
  };
}

/** A believable history for demos: solid on leaps and eighths, shaky on dots and accidentals. */
export const DEMO_PROFILE: Profile = {
  dotted: { hit: 8, total: 22 },
  eighths: { hit: 41, total: 46 },
  accidental: { hit: 7, total: 16 },
  leap: { hit: 29, total: 31 },
  offbeat: { hit: 14, total: 19 },
  timing: { hit: 52, total: 70 },
};
