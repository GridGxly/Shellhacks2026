// Turn a composed piece into practice cards — pure code, no AI calls.
// Gemini already told us WHAT is hard (trickySpots) and which chord each bar
// implies; this file decides HOW to practise it: rhythm alone, notes alone,
// a scale fragment, the chord as an arpeggio, then the spot and the piece.

import type { Exercise, Note } from '../music';
import { KEY_PC, type Settings, type Song, type Tag } from './lab';

export type CardKind = 'rhythm' | 'notes' | 'scale' | 'chord' | 'spot' | 'piece';

export interface Card {
  id: string;
  kind: CardKind;
  label: string; // e.g. "Rhythm · bar 3"
  why: string; // shown to the player: what this card trains
  bar: number | null; // 1-based source bar, null for whole-piece cards
  tag: Tag | null;
  ex: Exercise;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const pcOf = (m: number) => ((m % 12) + 12) % 12;

// ---------------------------------------------------------------- chords

const ROOT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "G", "Em", "D7", "Bb", "F#m", "Bdim", "Cmaj7" -> pitch classes (root first). Null if unreadable. */
export function chordPcs(symbol: string): number[] | null {
  const m = symbol.trim().match(/^([A-G])([#♯b♭]?)(maj7|m7|m|dim|7)?$/);
  if (!m) return null;
  const root = (ROOT[m[1]] + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0) + 12) % 12;
  const q = m[3] ?? '';
  const third = q === 'm' || q === 'm7' || q === 'dim' ? 3 : 4;
  const fifth = q === 'dim' ? 6 : 7;
  const pcs = [root, (root + third) % 12, (root + fifth) % 12];
  if (q === '7' || q === 'm7') pcs.push((root + 10) % 12);
  if (q === 'maj7') pcs.push((root + 11) % 12);
  return pcs;
}

/** Share of the bar (by duration, downbeat counted double) that sits on chord tones. */
function coverage(notes: Note[], pcs: number[], barStart: number): number {
  let on = 0, all = 0;
  for (const n of notes) {
    const w = n.durBeats * (n.startBeat === barStart ? 2 : 1);
    all += w;
    if (pcs.includes(pcOf(n.midi))) on += w;
  }
  return all ? on / all : 0;
}

/** The chord Gemini named for this bar if the notes back it up; otherwise the diatonic triad that fits best. */
export function verifiedChord(song: Song, s: Settings, barIdx: number): { symbol: string; pcs: number[]; fromAi: boolean } {
  const bpb = s.beatsPerBar;
  const notes = barNotes(song, bpb, barIdx);
  const claimed = song.chords[barIdx];
  const pcs = claimed ? chordPcs(claimed) : null;
  if (pcs && coverage(notes, pcs, barIdx * bpb) >= 0.5) return { symbol: claimed!, pcs, fromAi: true };
  const key = KEY_PC[s.key];
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  let best = { symbol: NAMES[key], pcs: [key, (key + 4) % 12, (key + 7) % 12], score: -1 };
  for (const deg of [0, 3, 4, 5, 1]) { // I, IV, V, vi, ii — the ones beginner melodies imply
    const root = (key + MAJOR[deg]) % 12;
    const third = (key + MAJOR[(deg + 2) % 7]) % 12;
    const fifth = (key + MAJOR[(deg + 4) % 7]) % 12;
    const tri = [root, third, fifth];
    const score = coverage(notes, tri, barIdx * bpb);
    if (score > best.score) best = { symbol: NAMES[root] + ((third - root + 12) % 12 === 3 ? 'm' : ''), pcs: tri, score };
  }
  return { symbol: best.symbol, pcs: best.pcs, fromAi: false };
}

// ---------------------------------------------------------------- helpers

const barNotes = (song: Song, bpb: number, barIdx: number) =>
  song.notes.filter((n) => n.startBeat >= barIdx * bpb - 1e-9 && n.startBeat < (barIdx + 1) * bpb - 1e-9);

/** Lay pitches out as quarter notes (last one held to fill its bar). */
function quarters(pitches: number[], bpb: number): { notes: Note[]; bars: number } {
  const bars = Math.max(1, Math.ceil(pitches.length / bpb));
  const notes = pitches.map((midi, i) => ({ midi, startBeat: i, durBeats: 1 }));
  const last = notes[notes.length - 1];
  if (last) last.durBeats = Math.min(4, bars * bpb - last.startBeat) as Note['durBeats'];
  // A held note may not be drawable (e.g. 2.5 beats): split into what Staff draws.
  if (last && ![1, 1.5, 2, 3, 4].includes(last.durBeats)) last.durBeats = 1;
  return { notes, bars };
}

/** Nearest pitch with this pitch class to `near` (keeps drills in the melody's register). */
const nearest = (pc: number, near: number) => {
  const base = near - pcOf(near) + pc;
  return [base - 12, base, base + 12].reduce((a, b) => (Math.abs(b - near) < Math.abs(a - near) ? b : a));
};

const exercise = (id: string, title: string, s: Settings, notes: Note[], bars: number, tempo: number): Exercise => ({
  id, type: 'encore', title, tempo: Math.round(tempo), beatsPerBar: s.beatsPerBar, bars, notes, keyPc: KEY_PC[s.key],
});

// ---------------------------------------------------------------- build the deck

const TAG_WHY: Record<Tag, string> = {
  dotted: 'the dotted figure', eighths: 'the eighth notes', accidental: 'the accidental',
  leap: 'the leap', offbeat: 'the off-beat entrance', timing: 'steady timing',
};

export function buildCards(song: Song, s: Settings): Card[] {
  const bpb = s.beatsPerBar;
  const key = KEY_PC[s.key];
  const cards: Card[] = [];
  const slow = Math.max(40, s.bpm * 0.7);

  // One set of drills per tricky spot (deduped, at most 3 bars).
  const spots = [...new Map(song.trickySpots.filter((t) => t.bar >= 1 && t.bar <= s.bars).map((t) => [t.bar, t])).values()].slice(0, 3);

  for (const spot of spots) {
    const b = spot.bar - 1;
    const src = barNotes(song, bpb, b);
    if (!src.length) continue;
    const at = (n: Note) => ({ ...n, startBeat: n.startBeat - b * bpb });
    const mid = [...src].sort((x, y) => x.midi - y.midi)[Math.floor(src.length / 2)].midi;
    const focus = TAG_WHY[spot.tag];

    // Rhythm: exactly the bar's rhythm, all on one comfortable pitch.
    cards.push({
      id: `rhythm-${spot.bar}`, kind: 'rhythm', label: `Rhythm · bar ${spot.bar}`, bar: spot.bar, tag: spot.tag,
      why: `Just the rhythm of bar ${spot.bar} on one note, so you can feel ${focus} without reading pitches.`,
      ex: exercise(`rhythm-${spot.bar}`, `Rhythm of bar ${spot.bar}`, s, src.map((n) => ({ ...at(n), midi: mid })), 1, s.bpm),
    });

    // Notes: the bar's pitches as even quarters, slower.
    const q = quarters(src.map((n) => n.midi), bpb);
    cards.push({
      id: `notes-${spot.bar}`, kind: 'notes', label: `Notes · bar ${spot.bar}`, bar: spot.bar, tag: spot.tag,
      why: `Bar ${spot.bar}'s pitches in even quarter notes — find the notes before adding the rhythm.`,
      ex: exercise(`notes-${spot.bar}`, `Notes of bar ${spot.bar}`, s, q.notes, q.bars, slow),
    });

    // Scale: the key's scale across the span of the bar, up and back.
    const lo = Math.min(...src.map((n) => n.midi)), hi = Math.max(...src.map((n) => n.midi));
    const up: number[] = [];
    for (let m = lo - 1; m <= hi + 1 && up.length < 8; m++) if (MAJOR.includes(pcOf(m - key)) || src.some((n) => n.midi === m)) up.push(m);
    const scale = quarters([...up, ...up.slice(0, -1).reverse()], bpb);
    cards.push({
      id: `scale-${spot.bar}`, kind: 'scale', label: `Scale · bar ${spot.bar}`, bar: spot.bar, tag: spot.tag,
      why: `${s.key} major across bar ${spot.bar}'s range${spot.tag === 'accidental' ? ' — including its accidental' : ''}, so your fingers know the path.`,
      ex: exercise(`scale-${spot.bar}`, `Scale around bar ${spot.bar}`, s, scale.notes, scale.bars, slow),
    });

    // Chord: the bar's (verified) harmony as an arpeggio near the melody.
    const chord = verifiedChord(song, s, b);
    const root = nearest(chord.pcs[0], mid - 4);
    const tones = [root, nearest(chord.pcs[1], root + 4), nearest(chord.pcs[2], root + 7)];
    const arp = quarters([...tones, root + 12, ...tones.slice().reverse()].slice(0, bpb * 2), bpb);
    cards.push({
      id: `chord-${spot.bar}`, kind: 'chord', label: `Chord · bar ${spot.bar} (${chord.symbol})`, bar: spot.bar, tag: spot.tag,
      why: `Bar ${spot.bar} sits on ${chord.symbol}${chord.fromAi ? '' : ' (checked against the notes)'}; arpeggiate it to hear where the melody lives.`,
      ex: exercise(`chord-${spot.bar}`, `${chord.symbol} arpeggio`, s, arp.notes, arp.bars, slow),
    });

    // The spot itself, slow then as written.
    cards.push({
      id: `spot-${spot.bar}`, kind: 'spot', label: `Bar ${spot.bar} slow`, bar: spot.bar, tag: spot.tag,
      why: `Bar ${spot.bar} exactly as written at 70% tempo. ${spot.note}`,
      ex: exercise(`spot-${spot.bar}`, `Bar ${spot.bar}`, s, src.map(at), 1, slow),
    });
  }

  cards.push({
    id: 'piece-slow', kind: 'piece', label: 'Whole piece · 70%', bar: null, tag: null,
    why: 'Put it together slowly.', ex: exercise('piece-slow', song.title, s, song.notes, s.bars, slow),
  });
  cards.push({
    id: 'piece', kind: 'piece', label: 'Whole piece · full tempo', bar: null, tag: null,
    why: 'The real thing, as written.', ex: exercise('piece', song.title, s, song.notes, s.bars, s.bpm),
  });
  return cards;
}
