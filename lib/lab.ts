import { PERFECT_MS } from './config';
import type { NoteResult } from './mic';
import { noteName, writtenKey, type Exercise, type Note } from './music';
import { validateExercise } from './training-core';

export const LAB_KEYS = [
  { label: 'C MAJ', tonic: 0, mode: 'major', spelling: 'sharps' },
  { label: 'G MAJ', tonic: 7, mode: 'major', spelling: 'sharps' },
  { label: 'D MAJ', tonic: 2, mode: 'major', spelling: 'sharps' },
  { label: 'F MAJ', tonic: 5, mode: 'major', spelling: 'flats' },
  { label: 'Bb MAJ', tonic: 10, mode: 'major', spelling: 'flats' },
  { label: 'A MIN', tonic: 9, mode: 'minor', spelling: 'sharps' },
  { label: 'D MIN', tonic: 2, mode: 'minor', spelling: 'flats' },
  { label: 'E MIN', tonic: 4, mode: 'minor', spelling: 'sharps' },
  { label: 'G MIN', tonic: 7, mode: 'minor', spelling: 'flats' },
] as const;

export const LAB_STYLES = ['folk', 'hymn', 'march', 'lullaby', 'dance'] as const;
export const LAB_FOCI = ['dotted', 'steps', 'leaps', 'scale', 'pulse'] as const;
export const LAB_DIFFS = ['easy', 'medium', 'hard'] as const;

export type LabStyle = (typeof LAB_STYLES)[number];
export type LabFocus = (typeof LAB_FOCI)[number];
export type LabDiff = (typeof LAB_DIFFS)[number];
export type LabMode = 'major' | 'minor';

export type LabSettings = {
  tonic: number;
  mode: LabMode;
  spelling: 'sharps' | 'flats';
  tempo: number;
  beatsPerBar: 3 | 4;
  bars: 4 | 8;
  difficulty: LabDiff;
  style: LabStyle;
  focus: LabFocus;
};

export type LabCard = {
  id: string;
  title: string;
  tag: string;
  kind: 'drill' | 'slow' | 'whole';
  ex: Exercise;
};

export type LabChatTurn = { from: 'player' | 'castor' | 'pollux'; text: string };

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const pc = (m: number) => ((m % 12) + 12) % 12;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const half = (n: number) => Math.round(n * 2) / 2;

export const defaultLabSettings = (): LabSettings => ({
  tonic: 2, mode: 'minor', spelling: 'flats', tempo: 72, beatsPerBar: 4, bars: 8, difficulty: 'easy', style: 'folk', focus: 'dotted',
});

export function keyIndex(settings: LabSettings) {
  const i = LAB_KEYS.findIndex(k => k.tonic === settings.tonic && k.mode === settings.mode);
  return i < 0 ? 0 : i;
}

export function keyLabel(settings: LabSettings) {
  return LAB_KEYS[keyIndex(settings)]?.label ?? 'C MAJ';
}

export function scalePcs(tonic: number, mode: LabMode) {
  return (mode === 'minor' ? MINOR : MAJOR).map(step => (tonic + step) % 12);
}

function inKey(midi: number, pcs: number[]) {
  return pcs.includes(pc(midi));
}

function nearestInKey(midi: number, pcs: number[]) {
  for (let d = 0; d <= 6; d++) {
    if (inKey(midi + d, pcs)) return clamp(midi + d, 60, 84);
    if (d && inKey(midi - d, pcs)) return clamp(midi - d, 60, 84);
  }
  return 60;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 0x85ebca6b) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
    return ((s ^ (s >>> 16)) >>> 0) / 0x100000000;
  };
}

function hashSettings(settings: LabSettings) {
  const raw = `${settings.tonic}${settings.mode}${settings.tempo}${settings.beatsPerBar}${settings.bars}${settings.difficulty}${settings.style}${settings.focus}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  return h >>> 0;
}

// One-bar rhythm motifs (beat lengths) per focus. Each new piece is built on a
// different one, so two pieces with the same settings still feel different.
const MOTIFS: Record<'dotted' | 'pulse' | 'other', Record<3 | 4, number[][]>> = {
  dotted: {
    4: [[1.5, 0.5, 1, 1], [1.5, 0.5, 1.5, 0.5], [1, 1.5, 0.5, 1], [0.5, 0.5, 1.5, 0.5, 1], [1.5, 0.5, 2]],
    3: [[1.5, 0.5, 1], [1, 1.5, 0.5], [0.5, 0.5, 1.5, 0.5]],
  },
  pulse: {
    4: [[1, 1, 1, 1], [1, 1, 2], [2, 1, 1], [1, 1, 1, 0.5, 0.5], [1, 2, 1]],
    3: [[1, 1, 1], [2, 1], [1, 2], [1, 1, 0.5, 0.5]],
  },
  other: {
    4: [[0.5, 0.5, 1, 0.5, 0.5, 1], [1, 0.5, 0.5, 2], [0.5, 1, 0.5, 2], [2, 0.5, 0.5, 1], [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [3, 1], [1, 0.5, 1, 0.5, 1]],
    3: [[1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1], [2, 0.5, 0.5], [0.5, 1, 0.5, 1], [1, 1, 1], [0.5, 0.5, 2]],
  },
};

export function labMotifs(focus: LabFocus, beatsPerBar: 3 | 4): number[][] {
  return MOTIFS[focus === 'dotted' ? 'dotted' : focus === 'pulse' ? 'pulse' : 'other'][beatsPerBar];
}

function pattern(focus: LabFocus, beatsPerBar: 3 | 4, difficulty: LabDiff, rand: () => number): number[] {
  if (focus === 'scale' && difficulty === 'hard') return Array.from({ length: beatsPerBar * 2 }, () => 0.5);
  const motifs = labMotifs(focus, beatsPerBar);
  // Two motifs alternating bar by bar: a main idea and an answer.
  const a = motifs[Math.floor(rand() * motifs.length)];
  const b = motifs[Math.floor(rand() * motifs.length)];
  return [...a, ...a, ...b, ...a];
}

function stepFrom(midi: number, pcs: number[], dir: number, leap: boolean) {
  const want = leap ? 5 + Math.abs(dir) : 1;
  let found = midi;
  let seen = 0;
  for (let d = 1; d <= 16; d++) {
    const next = midi + dir * d;
    if (next < 60 || next > 84) break;
    if (!inKey(next, pcs)) continue;
    seen++;
    found = next;
    if (seen >= want) break;
  }
  return found;
}

/** The Lab only offers LAB_KEYS. A key outside them keeps its mode (sad stays minor)
 *  and moves to the closest allowed tonic, instead of falling back to C major. */
export function nearestLabKey(tonic: number, mode: LabMode) {
  const dist = (k: (typeof LAB_KEYS)[number]) => { const d = Math.abs(k.tonic - tonic) % 12; return Math.min(d, 12 - d); };
  return LAB_KEYS.filter(k => k.mode === mode).reduce((best, k) => (dist(k) < dist(best) ? k : best));
}

export const LAB_KEY_NAMES = LAB_KEYS.map(k => `${k.label.replace(' MAJ', ' major').replace(' MIN', ' minor')} (tonic ${k.tonic})`).join(', ');

/** Offline guess at what a request means musically, used when Gemini can't answer. */
export function moodSettings(text: string, current: LabSettings): { settings: LabSettings; mood: 'sad' | 'happy' | 'spooky' | 'triumphant' | 'calm' | null } {
  const t = text.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const pick = (patch: Partial<LabSettings>) => clampLabSettings({ ...current, ...patch });
  if (has(/spook|scary|creep|haunt|dark|eerie|mysterious/)) return { mood: 'spooky', settings: pick({ tonic: 4, mode: 'minor', tempo: 60, style: 'hymn' }) };
  if (has(/sad|sorrow|melanchol|lonely|cry|grief|gloom|blue\b|minor/)) return { mood: 'sad', settings: pick({ tonic: 9, mode: 'minor', tempo: 66, style: 'lullaby' }) };
  if (has(/triumph|epic|heroic|victor|battle|march|bold|grand/)) return { mood: 'triumphant', settings: pick({ tonic: 10, mode: 'major', tempo: 112, style: 'march' }) };
  if (has(/happy|joy|bright|cheer|fun|upbeat|dance|sunny|major/)) return { mood: 'happy', settings: pick({ tonic: 7, mode: 'major', tempo: 120, style: 'dance' }) };
  if (has(/calm|peace|gentle|sleep|soft|lullab|relax/)) return { mood: 'calm', settings: pick({ tonic: 5, mode: 'major', tempo: 68, style: 'lullaby' }) };
  return { mood: null, settings: current };
}

/** Snap every note into the key and land the last one on the tonic, so the piece sounds like its key. */
export function fitToKey(ex: Exercise, settings: LabSettings): Exercise {
  const pcs = scalePcs(settings.tonic, settings.mode);
  const notes = ex.notes.map(n => ({ ...n, midi: nearestInKey(n.midi, pcs) }));
  const last = notes[notes.length - 1];
  if (last) {
    const options = [48, 60, 72, 84].map(o => o + settings.tonic).filter(m => m >= 60 && m <= 84);
    last.midi = options.reduce((a, b) => (Math.abs(b - last.midi) < Math.abs(a - last.midi) ? b : a));
  }
  return { ...ex, notes };
}

export function clampLabSettings(v: unknown): LabSettings {
  const base = defaultLabSettings();
  if (!v || typeof v !== 'object') return base;
  const o = v as Record<string, unknown>;
  const tonic = clamp(Math.round(Number(o.tonic)) || 0, 0, 11);
  const mode: LabMode = o.mode === 'minor' ? 'minor' : 'major';
  const match = nearestLabKey(tonic, mode);
  const tempo = clamp(Math.round(Number(o.tempo) || base.tempo), 48, 140);
  const beatsPerBar: 3 | 4 = Number(o.beatsPerBar) === 3 ? 3 : 4;
  const bars: 4 | 8 = Number(o.bars) === 4 ? 4 : 8;
  const difficulty = LAB_DIFFS.includes(o.difficulty as LabDiff) ? o.difficulty as LabDiff : 'easy';
  const style = LAB_STYLES.includes(o.style as LabStyle) ? o.style as LabStyle : 'folk';
  const focus = LAB_FOCI.includes(o.focus as LabFocus) ? o.focus as LabFocus : 'dotted';
  return { tonic: match.tonic, mode: match.mode, spelling: match.spelling, tempo, beatsPerBar, bars, difficulty, style, focus };
}

export function composeOffline(settings: LabSettings, seed = hashSettings(settings)): Exercise {
  const pcs = scalePcs(settings.tonic, settings.mode);
  const rand = rng(seed);
  const durs = pattern(settings.focus, settings.beatsPerBar, settings.difficulty, rand);
  const tonicMidi = nearestInKey(60 + ((settings.tonic - 0 + 12) % 12), pcs);
  let midi = tonicMidi;
  const notes: Note[] = [];
  let beat = 0;
  const total = settings.bars * settings.beatsPerBar;
  const leapChance = settings.focus === 'leaps' ? 0.45 : settings.difficulty === 'hard' ? 0.22 : 0.08;
  while (beat < total - 0.001 && notes.length < 64) {
    const dur = durs[notes.length % durs.length];
    const left = half(total - beat);
    const use = Math.min(dur, left);
    if (use < 0.5) break;
    if (notes.length) {
      const dir = rand() < 0.55 ? 1 : -1;
      midi = stepFrom(midi, pcs, dir, rand() < leapChance);
    }
    notes.push({ midi, startBeat: half(beat), durBeats: half(use) });
    beat = half(beat + use);
  }
  if (!notes.length) notes.push({ midi: tonicMidi, startBeat: 0, durBeats: settings.beatsPerBar });
  const last = notes[notes.length - 1];
  last.midi = tonicMidi;
  last.durBeats = half(Math.max(0.5, Math.min(last.durBeats, total - last.startBeat)));
  const title = `${keyLabel(settings)} ${settings.style}`.slice(0, 100);
  const type: Exercise['type'] = settings.focus === 'pulse' || settings.focus === 'dotted' ? 'rhythm' : settings.focus === 'leaps' ? 'chord' : 'scale';
  const ex: Exercise = {
    id: `lab-${seed.toString(16)}`,
    type,
    title,
    tempo: settings.tempo,
    beatsPerBar: settings.beatsPerBar,
    bars: settings.bars,
    notes,
  };
  return validateLabExercise(ex) ?? ex;
}

export function validateLabExercise(v: unknown): Exercise | null {
  const ex = validateExercise(v);
  if (!ex) return null;
  if (ex.notes.length > 64) return null;
  for (const n of ex.notes) {
    if (n.midi < 60 || n.midi > 84) return null;
    if (Math.abs(n.startBeat * 2 - Math.round(n.startBeat * 2)) > 0.001) return null;
    if (Math.abs(n.durBeats * 2 - Math.round(n.durBeats * 2)) > 0.001) return null;
  }
  return ex;
}

function barNotes(ex: Exercise, bar: number): Note[] {
  const start = bar * ex.beatsPerBar;
  const end = start + ex.beatsPerBar;
  return ex.notes.filter(n => n.startBeat >= start - 0.001 && n.startBeat < end - 0.001).map(n => ({ ...n, startBeat: half(n.startBeat - start) }));
}

function fillBar(ex: Exercise, bar: number): Note[] {
  const taken = barNotes(ex, bar);
  if (taken.length >= 3) return taken;
  const pcs = [...new Set(ex.notes.map(n => pc(n.midi)))];
  const tonic = ex.notes[0]?.midi ?? 60;
  const notes: Note[] = [];
  for (let b = 0; b < ex.beatsPerBar && notes.length < 8; b++) {
    const midi = nearestInKey(tonic + (b % 5) * 2, pcs.length ? pcs : [pc(tonic)]);
    notes.push({ midi, startBeat: b, durBeats: 1 });
  }
  return notes;
}

function retitle(ex: Exercise, id: string, title: string, type: Exercise['type'], tempo = ex.tempo, bars = 1): Exercise {
  const notes = ex.notes.map(n => ({ ...n }));
  const next: Exercise = { ...ex, id, title: title.slice(0, 100), type, tempo, bars, notes };
  return validateExercise(next) ?? next;
}

export function buildCards(ex: Exercise): LabCard[] {
  const cards: LabCard[] = [];
  const drills = Math.min(ex.bars, 3);
  for (let bar = 0; bar < drills; bar++) {
    const notes = fillBar(ex, bar);
    const end = Math.max(...notes.map(n => n.startBeat + n.durBeats), ex.beatsPerBar);
    const type: Exercise['type'] = bar === 1 ? 'rhythm' : bar === 2 ? 'chord' : 'scale';
    const title = `BAR ${bar + 1} · ${type.toUpperCase()}`;
    const piece = retitle({ ...ex, notes, bars: 1, beatsPerBar: ex.beatsPerBar }, `${ex.id}-b${bar}`, title, type);
    if (end > ex.beatsPerBar) piece.notes = notes.map(n => ({ ...n, durBeats: Math.min(n.durBeats, ex.beatsPerBar - n.startBeat) })).filter(n => n.durBeats >= 0.5);
    cards.push({ id: piece.id, title, tag: 'DRILL', kind: 'drill', ex: piece });
  }
  if (ex.bars >= 2) {
    const first = [...fillBar(ex, 0), ...fillBar(ex, 1).map(n => ({ ...n, startBeat: n.startBeat + ex.beatsPerBar }))];
    const slow = retitle({ ...ex, notes: first, bars: 2 }, `${ex.id}-slow12`, 'BARS 1-2 SLOW', 'rhythm', Math.max(40, Math.round(ex.tempo * 0.7)), 2);
    cards.push({ id: slow.id, title: slow.title, tag: '70%', kind: 'slow', ex: slow });
  }
  const wholeSlow = retitle(ex, `${ex.id}-slow`, 'WHOLE SLOW', ex.type, Math.max(40, Math.round(ex.tempo * 0.7)), ex.bars);
  const whole = retitle(ex, `${ex.id}-full`, 'THE PIECE', ex.type, ex.tempo, ex.bars);
  cards.push({ id: wholeSlow.id, title: wholeSlow.title, tag: '70%', kind: 'slow', ex: wholeSlow });
  cards.push({ id: whole.id, title: whole.title, tag: 'FULL', kind: 'whole', ex: whole });
  return cards;
}

export function gradeLetter(notes: NoteResult[]): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (!notes.length) return 'D';
  const hits = notes.filter(n => n.status === 'hit').length / notes.length;
  const timed = notes.filter(n => n.onsetOffsetMs !== null);
  const tight = timed.length ? timed.filter(n => Math.abs(n.onsetOffsetMs!) <= PERFECT_MS).length / timed.length : 0;
  if (hits >= 0.95 && tight >= 0.8) return 'S';
  if (hits >= 0.85) return 'A';
  if (hits >= 0.7) return 'B';
  if (hits >= 0.5) return 'C';
  return 'D';
}

export function analyzeTake(ex: Exercise, notes: NoteResult[], inst: { shift: number; writtenOffset: number }, concertKey = 0, spelling?: 'sharps' | 'flats'): string[] {
  const key = writtenKey(inst.writtenOffset, concertKey, spelling);
  const lines: string[] = [];
  const hits = notes.filter(n => n.status === 'hit').length;
  const silent = notes.filter(n => n.status === 'silent').length;
  const wrong = notes.filter(n => n.status === 'wrong').length;
  const late = notes.filter(n => (n.onsetOffsetMs ?? 0) > PERFECT_MS).length;
  const early = notes.filter(n => (n.onsetOffsetMs ?? 0) < -PERFECT_MS).length;
  lines.push(`${hits}/${notes.length} notes matched. ${silent ? `${silent} silent. ` : ''}${wrong ? `${wrong} off-pitch. ` : ''}`.trim());
  if (late > early && late) lines.push('Attacks sat late. Land the tongue on the beat, then hold.');
  else if (early > late && early) lines.push('Attacks sat early. Wait for the beat, then speak the note.');
  else if (hits === notes.length) lines.push('Pitch and pulse both held. Take the next card a little faster.');
  const worst = notes.find(n => n.status === 'wrong') ?? notes.find(n => n.status === 'silent');
  if (worst) {
    const expect = noteName(ex.notes[worst.index].midi + inst.shift + inst.writtenOffset, key);
    lines.push(worst.status === 'silent' ? `${expect} never spoke. Breath on the rest, sound on the note.` : `${expect} wandered. Hear the card once, then play that pitch alone.`);
  }
  return lines.slice(0, 4);
}

export function suggestedNext(cards: LabCard[], currentId: string, notes: NoteResult[]): string | null {
  const i = cards.findIndex(c => c.id === currentId);
  if (i < 0) return cards[0]?.id ?? null;
  const silent = notes.some(n => n.status === 'silent' || n.status === 'wrong');
  const late = notes.filter(n => Math.abs(n.onsetOffsetMs ?? 0) > PERFECT_MS).length > notes.length / 3;
  if (silent) {
    const drill = cards.find(c => c.kind === 'drill' && c.id !== currentId);
    if (drill) return drill.id;
  }
  if (late) {
    const slow = cards.find(c => c.kind === 'slow');
    if (slow && slow.id !== currentId) return slow.id;
  }
  return cards[Math.min(i + 1, cards.length - 1)]?.id ?? null;
}

export function clampChatHistory(value: unknown): LabChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: LabChatTurn[] = [];
  for (const row of value.slice(-12)) {
    if (!row || typeof row !== 'object') continue;
    const from = (row as LabChatTurn).from;
    const text = String((row as LabChatTurn).text ?? '').replace(/[<>\u0000-\u001f]/g, '').slice(0, 280).trim();
    if (!text) continue;
    if (from !== 'player' && from !== 'castor' && from !== 'pollux') continue;
    out.push({ from, text });
  }
  return out;
}

export function hintFor(focus: keyof LabSettings | 'none', settings: LabSettings) {
  if (focus === 'tempo') return settings.tempo <= 76 ? 'Slow enough that the dotted quarters can land.' : 'A walking pulse. Keep the tongue honest.';
  if (focus === 'tonic' || focus === 'mode') return 'Castor keeps every pitch inside this key.';
  if (focus === 'beatsPerBar') return 'Three feels like a sway. Four feels like a march.';
  if (focus === 'bars') return 'Four bars to learn it. Eight bars to tell a story.';
  if (focus === 'difficulty') return settings.difficulty === 'easy' ? 'Short steps, a kind range.' : 'More notes, tighter corners.';
  if (focus === 'style') return `A ${settings.style} shape. Pollux will keep the costume.`;
  if (focus === 'focus') {
    if (settings.focus === 'dotted') return 'Long, then short. Do not rush the long one.';
    if (settings.focus === 'leaps') return 'Jump, then settle. The landing is the music.';
    if (settings.focus === 'scale') return 'Up the ladder, then down. One finger at a time.';
    if (settings.focus === 'pulse') return 'Every beat a stone. No skipping.';
    return 'Steps next door. Keep them neighborly.';
  }
  return '';
}
