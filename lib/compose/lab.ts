// Gemini Lab: student stats -> analysis + suggested settings (each with a reason)
// -> composed piece. Prompts, schemas and validation live here so the API routes,
// the Lab screen and scripts/gemini-lab.mjs all mean the same thing.

import type { Exercise, Note } from '../music';
import { TAGS, TAG_LABEL, type Tag } from '../mentor/tags';

export { TAGS, TAG_LABEL };
export type { Tag };

/** hit / total per tag (same numbers lib/mentor/tags.ts tallies from real takes). */
export type LabProfile = Record<Tag, [number, number]>;

export const PRESETS: Record<string, { label: string; profile: LabProfile }> = {
  demo: { label: 'Demo Student', profile: { dotted: [8, 22], eighths: [41, 46], accidental: [7, 16], leap: [29, 31], offbeat: [14, 19], timing: [52, 70] } },
  beginner: { label: 'Beginner', profile: { dotted: [2, 9], eighths: [5, 14], accidental: [1, 6], leap: [4, 10], offbeat: [1, 5], timing: [10, 30] } },
  strong: { label: 'Strong Reader', profile: { dotted: [30, 33], eighths: [88, 92], accidental: [25, 29], leap: [40, 44], offbeat: [21, 24], timing: [80, 95] } },
  timing: { label: 'Rushes a lot', profile: { dotted: [18, 22], eighths: [40, 44], accidental: [15, 17], leap: [20, 22], offbeat: [9, 20], timing: [12, 60] } },
};

export const KEYS = ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb'] as const;
export type KeyName = (typeof KEYS)[number];
export const KEY_PC: Record<KeyName, number> = { C: 0, G: 7, D: 2, A: 9, F: 5, Bb: 10, Eb: 3 };

export interface Settings {
  key: KeyName;
  bpm: number;
  beatsPerBar: 3 | 4;
  bars: number;
  difficulty: number;
  style: string;
  focus: Tag[];
}
export type SettingName = keyof Settings;
export const SETTING_NAMES: SettingName[] = ['key', 'bpm', 'beatsPerBar', 'bars', 'difficulty', 'style', 'focus'];

export interface Analysis {
  strengths: { tag: Tag; why: string }[];
  weaknesses: { tag: Tag; why: string }[];
  recommendation: string;
  settings: { [K in SettingName]: { value: Settings[K]; reason: string } };
}

export interface Song {
  title: string;
  notes: Note[];
  chords: string[];
  trickySpots: { bar: number; tag: Tag; note: string }[];
}

// ---------------------------------------------------------------- validation of inputs

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);

export function cleanProfile(v: unknown): LabProfile | null {
  if (!v || typeof v !== 'object') return null;
  const out = {} as LabProfile;
  for (const t of TAGS) {
    const pair = (v as Record<string, unknown>)[t];
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const total = clampInt(pair[1], 0, 10_000, 0);
    out[t] = [clampInt(pair[0], 0, total, 0), total];
  }
  return out;
}

/** Clamp anything (AI output or a client request) to settings the game can play. */
export function cleanSettings(v: Partial<Record<SettingName, unknown>>): Settings {
  const key = KEYS.includes(v.key as KeyName) ? (v.key as KeyName) : 'C';
  const focus = Array.isArray(v.focus) ? (v.focus.filter((t) => TAGS.includes(t as Tag)).slice(0, 3) as Tag[]) : [];
  return {
    key,
    bpm: clampInt(v.bpm, 40, 180, 80),
    beatsPerBar: v.beatsPerBar === 3 ? 3 : 4,
    bars: clampInt(v.bars, 2, 8, 4),
    difficulty: clampInt(v.difficulty, 1, 5, 2),
    style: typeof v.style === 'string' && v.style.trim() ? v.style.trim().slice(0, 60) : 'folk song',
    focus,
  };
}

/** Clamp the AI's suggested values in place, keeping its reasons. */
export function cleanAnalysis(a: Analysis): Analysis {
  const values = cleanSettings(Object.fromEntries(SETTING_NAMES.map((k) => [k, a.settings?.[k]?.value])));
  const settings = Object.fromEntries(SETTING_NAMES.map((k) => [k, { value: values[k], reason: String(a.settings?.[k]?.reason ?? '').slice(0, 300) }])) as Analysis['settings'];
  const tagged = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x) => TAGS.includes(x?.tag)).slice(0, 3).map((x) => ({ tag: x.tag as Tag, why: String(x.why ?? '').slice(0, 300) })) : []);
  return { strengths: tagged(a.strengths), weaknesses: tagged(a.weaknesses), recommendation: String(a.recommendation ?? '').slice(0, 500), settings };
}

// ---------------------------------------------------------------- prompts + schemas (Gemini structured output)

const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra });
const reasoned = (value: object) => S('OBJECT', { properties: { value, reason: S('STRING') }, required: ['value', 'reason'] });
const tagItem = S('OBJECT', { properties: { tag: S('STRING', { enum: TAGS }), why: S('STRING') }, required: ['tag', 'why'] });

export const ANALYZE_SCHEMA = S('OBJECT', {
  properties: {
    strengths: S('ARRAY', { items: tagItem }),
    weaknesses: S('ARRAY', { items: tagItem }),
    recommendation: S('STRING'),
    settings: S('OBJECT', {
      properties: {
        key: reasoned(S('STRING', { enum: [...KEYS] })),
        bpm: reasoned(S('INTEGER')),
        beatsPerBar: reasoned(S('INTEGER')), // Gemini enums must be strings; cleaned to 3|4
        bars: reasoned(S('INTEGER')),
        difficulty: reasoned(S('INTEGER')),
        style: reasoned(S('STRING')),
        focus: reasoned(S('ARRAY', { items: S('STRING', { enum: TAGS }) })),
      },
      required: SETTING_NAMES,
    }),
  },
  required: ['strengths', 'weaknesses', 'recommendation', 'settings'],
});

export const profileLines = (p: LabProfile) => TAGS.map((t) => `${t}: ${p[t][0]}/${p[t][1]} (${p[t][1] ? Math.round((100 * p[t][0]) / p[t][1]) : 0}%)`).join('\n');

export const analyzePrompt = (p: LabProfile) => `You are a high-school band director reviewing a student's sight-reading stats.
Each line is: skill: notes played correctly / notes attempted (success rate).
${profileLines(p)}

Identify up to 2 strengths and up to 2 weaknesses. Every "why" must quote the numbers above.
Recommend what to practice next in one or two sentences.
Suggest settings for ONE short new sight-reading piece that targets the weaknesses while staying readable.
Every setting needs a "reason" that names which numbers it is based on.
Constraints: key one of ${KEYS.join(', ')}; bpm 50-140; beatsPerBar 3 or 4; bars 4 or 8; difficulty 1 (easiest) to 5; focus = 1-2 of the tags.`;

export const COMPOSE_SCHEMA = S('OBJECT', {
  properties: {
    title: S('STRING'),
    notes: S('ARRAY', { items: S('OBJECT', { properties: { midi: S('INTEGER'), startBeat: S('NUMBER'), durBeats: S('NUMBER') }, required: ['midi', 'startBeat', 'durBeats'] }) }),
    chords: S('ARRAY', { items: S('STRING') }),
    trickySpots: S('ARRAY', { items: S('OBJECT', { properties: { bar: S('INTEGER'), tag: S('STRING', { enum: TAGS }), note: S('STRING') }, required: ['bar', 'tag', 'note'] }) }),
  },
  required: ['title', 'notes', 'chords', 'trickySpots'],
});

export const composePrompt = (s: Settings, weaknesses: string[]) => `Compose a short, singable sight-reading melody for a student.
${weaknesses.length ? `Student weaknesses: ${weaknesses.join(' ')}\n` : ''}Key: ${s.key} major. Time: ${s.beatsPerBar}/4. Bars: ${s.bars}. Tempo: ${s.bpm} BPM. Difficulty ${s.difficulty}/5. Style: ${s.style}.
${s.focus.length ? `Feature these skills clearly: ${s.focus.map((t) => TAG_LABEL[t]).join(', ')}.` : ''}
Rules:
- One note at a time. MIDI numbers, concert pitch, between 60 and 79.
- durBeats only from: 0.5, 1, 1.5, 2, 3, 4. startBeat counts from 0 in quarter-note beats.
- Every bar is exactly ${s.beatsPerBar} beats; no note may cross a bar line; notes are in order and do not overlap; the piece fills exactly ${s.bars} bars.
- Start on a note of the tonic chord, mostly move by step, follow a leap with a step back, repeat a rhythm idea, and END on the tonic.
- chords: one chord symbol per bar (e.g. "G", "C", "D7", "Em").
- trickySpots: the bars (1-based) that practise the focus skills, with the tag and a short note to the player.`;

// ---------------------------------------------------------------- song checks + conversion

const DRAWABLE = new Set([0.5, 1, 1.5, 2, 3, 4]);
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const midiName = (m: number) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

/** Everything the game needs for the piece to draw and grade correctly. */
export function validateSong(song: Song, s: Settings): string[] {
  const errs: string[] = [];
  if (!Array.isArray(song?.notes) || !song.notes.length) return ['no notes'];
  const bpb = s.beatsPerBar;
  const total = s.bars * bpb;
  let end = 0;
  song.notes.forEach((n, i) => {
    const at = `note ${i + 1} (${midiName(n.midi)} @ beat ${n.startBeat})`;
    if (!DRAWABLE.has(n.durBeats)) errs.push(`${at}: length ${n.durBeats} can't be drawn`);
    if (n.startBeat < end - 1e-9) errs.push(`${at}: overlaps the previous note`);
    if (Math.floor(n.startBeat / bpb) !== Math.floor((n.startBeat + n.durBeats - 1e-9) / bpb)) errs.push(`${at}: crosses a bar line`);
    if (n.midi < 55 || n.midi > 84) errs.push(`${at}: out of range`);
    end = n.startBeat + n.durBeats;
  });
  if (Math.abs(end - total) > 1e-9) errs.push(`fills ${end} beats, expected ${total} (${s.bars} bars of ${bpb})`);
  const last = song.notes[song.notes.length - 1];
  if ((((last.midi - KEY_PC[s.key]) % 12) + 12) % 12 !== 0) errs.push(`ends on ${midiName(last.midi)}, not the tonic ${s.key}`);
  (song.trickySpots ?? []).forEach((t) => { if (t.bar < 1 || t.bar > s.bars) errs.push(`tricky spot in bar ${t.bar}, which doesn't exist`); });
  return errs;
}

export function songToExercise(song: Song, s: Settings): Exercise {
  return {
    id: `lab-${song.title}`,
    type: 'encore',
    title: song.title,
    tempo: s.bpm,
    beatsPerBar: s.beatsPerBar,
    bars: s.bars,
    notes: [...song.notes].sort((a, b) => a.startBeat - b.startBeat),
    chordLabels: song.chords.slice(0, s.bars).map((label, bar) => ({ bar, label })),
    keyPc: KEY_PC[s.key],
  };
}

/** Canned answers so the Lab works with no API key (and costs nothing). */
export const MOCK_ANALYSIS: Analysis = {
  strengths: [{ tag: 'leap', why: 'Big leaps 29/31 (94%).' }, { tag: 'eighths', why: 'Eighth notes 41/46 (89%).' }],
  weaknesses: [{ tag: 'dotted', why: 'Dotted rhythms only 8/22 (36%).' }, { tag: 'accidental', why: 'Accidentals 7/16 (44%).' }],
  recommendation: '[MOCK] Drill dotted-quarter figures in a key with one sharp so accidentals show up in context.',
  settings: {
    key: { value: 'G', reason: 'One sharp adds accidental practice (accidentals 44%).' },
    bpm: { value: 80, reason: 'Timing is 52/70 (74%) — not ready to push tempo.' },
    beatsPerBar: { value: 4, reason: 'Dotted quarters sit most naturally in 4/4.' },
    bars: { value: 4, reason: 'Short enough to read cold with two weaknesses in play.' },
    difficulty: { value: 2, reason: 'Two weaknesses at once — keep the rest easy.' },
    style: { value: 'march', reason: 'Marches are built on dotted rhythms (36%).' },
    focus: { value: ['dotted', 'accidental'], reason: 'The two lowest rates: 36% and 44%.' },
  },
};

export const MOCK_SONG: Song = {
  title: '[MOCK] Dotted March in G',
  notes: [
    [67, 0, 1.5], [69, 1.5, 0.5], [71, 2, 1], [67, 3, 1],
    [72, 4, 1.5], [71, 5.5, 0.5], [69, 6, 2],
    [71, 8, 1.5], [72, 9.5, 0.5], [74, 10, 1], [71, 11, 1],
    [69, 12, 1], [66, 13, 1], [67, 14, 2],
  ].map(([midi, startBeat, durBeats]) => ({ midi, startBeat, durBeats })),
  chords: ['G', 'C', 'G', 'D7'],
  trickySpots: [{ bar: 1, tag: 'dotted', note: 'Dotted quarter + eighth: count "1 (2) &".' }, { bar: 4, tag: 'accidental', note: 'F♯ leading back to G.' }],
};
