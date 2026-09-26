// Music content (PRD §5): notes are stored in CONCERT pitch, key of B♭ major.
// Written pitch for display = concert + instrument.writtenOffset.

export type CardType = 'chord' | 'scale' | 'rhythm';

export interface Note {
  midi: number; // concert
  startBeat: number;
  durBeats: number;
}

export interface Exercise {
  id: string;
  type: CardType | 'encore';
  title: string; // e.g. "I – IV – V"
  tempo: number;
  beatsPerBar: number;
  bars: number;
  notes: Note[];
  chordLabels?: { bar: number; label: string }[];
}

// B♭ major, concert.
const BB = 70;
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const deg = (d: number) => BB + Math.floor(d / 7) * 12 + SCALE[((d % 7) + 7) % 7]; // d=0 -> B♭4

function sequence(pitches: number[], durs: number[]): Note[] {
  let beat = 0;
  return pitches.map((midi, i) => {
    const n = { midi, startBeat: beat, durBeats: durs[i] };
    beat += durs[i];
    return n;
  });
}

// Ode to Joy, bars 1–8 (public domain), concert B♭.
const ODE_D = [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2];
const odePitches = [
  ...ODE_D.map(deg), deg(2), deg(1), deg(1),
  ...ODE_D.map(deg), deg(1), deg(0), deg(0),
];
const odeDurs = [...Array(12).fill(1), 1.5, 0.5, 2, ...Array(12).fill(1), 1.5, 0.5, 2];

export const ODE_TO_JOY: Exercise = {
  id: 'ode-encore',
  type: 'encore',
  title: 'Ode to Joy · bars 1–8',
  tempo: 96,
  beatsPerBar: 4,
  bars: 8,
  notes: sequence(odePitches, odeDurs),
};

let uid = 0;
const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Chord cards: I / IV / V arpeggios, one note at a time (PRD: no true chords).
const CHORDS: Record<string, number[]> = {
  I: [0, 2, 4, 7],
  IV: [-4, -2, 0, 3],
  V: [-3, -1, 1, 4],
};
const PROGRESSIONS = [['I', 'IV', 'V'], ['I', 'V', 'I'], ['IV', 'V', 'I'], ['I', 'IV', 'I'], ['V', 'IV', 'I']];
const PATTERNS = [
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [0, 2, 1, 3],
  [0, 1, 2, 1],
];

function chordExercise(tempo: number): Exercise {
  const prog = rand(PROGRESSIONS);
  const pitches: number[] = [];
  prog.forEach((c) => {
    const p = rand(PATTERNS);
    p.forEach((i) => pitches.push(deg(CHORDS[c][i])));
  });
  return {
    id: `chord-${uid++}`,
    type: 'chord',
    title: prog.join(' – '),
    tempo,
    beatsPerBar: 4,
    bars: 3,
    notes: sequence(pitches, Array(12).fill(1)),
    chordLabels: prog.map((label, bar) => ({ bar, label })),
  };
}

// Highest scale degree any shape reaches is start + 7. Starts above 0 put the top
// note past B♭5 concert, which is above a trumpet's written C6 (see INSTRUMENTS).
const SCALE_STARTS = [0, 0, -1, -2, -3];

function scaleExercise(tempo: number): Exercise {
  const start = rand(SCALE_STARTS);
  const up = Array.from({ length: 8 }, (_, i) => start + i);
  const shapes = [
    [...up, ...up.slice(0, 4).reverse().map((d) => d + 4)],
    [...up.slice().reverse(), ...up.slice(0, 4)],
    [...up.slice(0, 6), ...up.slice(0, 6).reverse()],
  ];
  const degs = rand(shapes).slice(0, 12);
  return {
    id: `scale-${uid++}`,
    type: 'scale',
    title: 'B♭ major',
    tempo,
    beatsPerBar: 4,
    bars: 3,
    notes: sequence(degs.map(deg), Array(12).fill(1)),
  };
}

// Rhythm cards: one pitch (concert F), rhythm cells per bar.
const CELLS = [
  [1, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [2, 1, 1],
  [0.5, 0.5, 1, 0.5, 0.5, 1],
  [1.5, 0.5, 2],
  [1, 1, 2],
];
function rhythmExercise(tempo: number): Exercise {
  const durs = [rand(CELLS), rand(CELLS), rand(CELLS)].flat();
  return {
    id: `rhythm-${uid++}`,
    type: 'rhythm',
    title: 'on concert F',
    tempo,
    beatsPerBar: 4,
    bars: 3,
    notes: sequence(Array(durs.length).fill(deg(-3)), durs),
  };
}

/** Identity of an exercise's music (ids are always new, so compare the notes). */
export const exerciseKey = (ex: Exercise) => `${ex.type}:${ex.notes.map((n) => `${n.midi}/${n.durBeats}`).join(',')}`;

export function makeExercise(type: CardType, tempo: number): Exercise {
  if (type === 'chord') return chordExercise(tempo);
  if (type === 'scale') return scaleExercise(tempo);
  return rhythmExercise(tempo);
}

// ---------- Spelling & staff ----------

type KeySig = { name: string; accidentals: number }; // + sharps, - flats
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function writtenKey(offset: number): KeySig {
  // Concert B♭ transposed by the instrument's written offset.
  const pc = (((10 + offset) % 12) + 12) % 12;
  const table: Record<number, KeySig> = {
    0: { name: 'C', accidentals: 0 },
    7: { name: 'G', accidentals: 1 },
    2: { name: 'D', accidentals: 2 },
    5: { name: 'F', accidentals: -1 },
    10: { name: 'B♭', accidentals: -2 },
    3: { name: 'E♭', accidentals: -3 },
  };
  return table[pc] ?? { name: 'C', accidentals: 0 };
}

export function noteName(midi: number, key: KeySig): string {
  const pc = ((midi % 12) + 12) % 12;
  return (key.accidentals < 0 ? FLAT_NAMES : SHARP_NAMES)[pc];
}

/** Diatonic staff step: 0 = E4 (bottom line), each +1 is one line/space up. */
export function staffStep(midi: number, key: KeySig): number {
  const name = noteName(midi, key);
  const letter = LETTERS.indexOf(name[0]);
  const octave = Math.floor(midi / 12) - 1;
  // C♭/B♯ edge cases don't occur in these keys.
  const diatonic = octave * 7 + letter;
  const e4 = 4 * 7 + 2;
  return diatonic - e4;
}

export const SHARP_STEPS = [8, 5, 9, 6, 3]; // F C G D A on treble staff
export const FLAT_STEPS = [4, 7, 3, 6, 2]; // B E A D G
