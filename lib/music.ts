// Music content (PRD §5): notes are stored in CONCERT pitch, key of B♭ major.
// Written pitch for display = concert + instrument.writtenOffset.
import { TAVERN_TEMPO } from './config';

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

// A major, concert — the key of Gran Vals (F♯, C♯, G♯).
const TONIC = 69; // A4
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const deg = (d: number) => TONIC + Math.floor(d / 7) * 12 + SCALE[((d % 7) + 7) % 7]; // d=0 -> A4

function sequence(pitches: number[], durs: number[]): Note[] {
  let beat = 0;
  return pitches.map((midi, i) => {
    const n = { midi, startBeat: beat, durBeats: durs[i] };
    beat += durs[i];
    return n;
  });
}

// Gran Vals / "Nokia Tune" (Tárrega, 1902, public domain), concert A major.
// Transcribed from the treble-clef melody line (bass-clef chords dropped —
// PRD: no true chords, one note at a time). The 4-bar phrase repeats 3x =
// 12 bars, 36 beats. Absolute MIDI, not scale-degree (deg()) based, since
// this piece is in A major rather than this file's B♭ — see note above
// makeExercise if adding more absolute-pitch content like this.
const GRAN_VALS_PHRASE: { midi: number; durBeats: number }[] = [
  { midi: 76, durBeats: 0.5 }, // E5
  { midi: 74, durBeats: 0.5 }, // D5
  { midi: 66, durBeats: 1 }, // F#4
  { midi: 68, durBeats: 1 }, // G#4
  { midi: 73, durBeats: 0.5 }, // C#5
  { midi: 71, durBeats: 0.5 }, // B4
  { midi: 62, durBeats: 1 }, // D4
  { midi: 64, durBeats: 1 }, // E4
  { midi: 71, durBeats: 0.5 }, // B4
  { midi: 69, durBeats: 0.5 }, // A4
  { midi: 61, durBeats: 1 }, // C#4
  { midi: 64, durBeats: 1 }, // E4
  { midi: 69, durBeats: 2 }, // A4, half note + fermata (beat 3 is rest)
];
/**
 * Lay the phrase out on real bar lines. The last note is a half note with a
 * fermata, so beat 3 of every 4th bar is a rest — sequence() packs notes
 * end-to-end and cannot express that, which would pull each repeat a beat
 * early.
 */
function granValsNotes(repeats: number): Note[] {
  const out: Note[] = [];
  const phraseBeats = 4 * 3; // 4 bars of 3/4
  for (let r = 0; r < repeats; r += 1) {
    let beat = r * phraseBeats;
    GRAN_VALS_PHRASE.forEach((n, i) => {
      out.push({ midi: n.midi, startBeat: beat, durBeats: n.durBeats });
      // The held note ends its bar; the following rest is implied by the gap.
      beat = i === GRAN_VALS_PHRASE.length - 1 ? (r + 1) * phraseBeats : beat + n.durBeats;
    });
  }
  return out;
}

// Harmony implied by the melody notes in each bar (V-I-I-I): E (V) resolves
// into A (I) for the rest of the phrase, matching the piece's actual cadence.
const GRAN_VALS_CHORDS: { bar: number; label: string }[] = [
  { bar: 0, label: 'E' },
  { bar: 1, label: 'A' },
  { bar: 2, label: 'A' },
  { bar: 3, label: 'A' },
];

export const GRAN_VALS: Exercise = {
  id: 'ode-encore',
  type: 'encore',
  title: 'Gran Vals · bars 13–16 (Nokia Tune)',
  tempo: 100, // half the source's 200 BPM (see comment below) at 3/4
  beatsPerBar: 3,
  bars: 4,
  notes: granValsNotes(1),
  chordLabels: GRAN_VALS_CHORDS,
};

export const DUET_A: Exercise = { ...GRAN_VALS, id: 'duet-a', title: 'Duet · Part A (melody)', tempo: TAVERN_TEMPO };
// A simpler quarter-note response in a shared playable register. Downbeats
// form thirds or a unison with A; short melody eighths are passing tones.
// Both parts finish together, leaving the final beat as the phrase's rest.
export const DUET_B: Exercise = {
  id: 'duet-b', type: 'encore', title: 'Duet · Part B (harmony)',
  tempo: DUET_A.tempo, beatsPerBar: 3, bars: 4,
  notes: sequence([76, 66, 69, 71, 68, 64, 69, 66, 69, 69], [1, 1, 1, 1, 1, 1, 1, 1, 1, 2]),
};

let uid = 0;

/**
 * Chord card: the song's harmony as arpeggios, one note per beat in 3/4.
 * E · A · A · A — matches GRAN_VALS_CHORDS, the harmony implied by the
 * encore's melody notes (V resolving into I for the rest of the phrase).
 */
const CHORD_BARS: { label: string; midi: number[] }[] = [
  { label: 'E', midi: [64, 68, 71] }, // E4 G♯4 B4
  { label: 'A', midi: [69, 73, 76] }, // A4 C♯5 E5
  { label: 'A', midi: [69, 73, 76] }, // A4 C♯5 E5
  { label: 'A', midi: [69, 73, 76] }, // A4 C♯5 E5
];

/**
 * Difficulty tier, 1..3 — the three fights of act 1 ramp from a bare outline
 * of the music to the real thing. Later acts use the top tier.
 */
export type Tier = 1 | 2 | 3;
export const tierForFloor = (floor: number): Tier => (floor <= 1 ? 1 : floor === 2 ? 2 : 3);

function chordExercise(tempo: number, tier: Tier): Exercise {
  // 1: hold the root for the whole bar. 2: root (half) + fifth (quarter).
  // 3: the full triad, one note per beat.
  const perBar = CHORD_BARS.map((b) => {
    if (tier === 1) return { midi: [b.midi[0]], durs: [3] };
    if (tier === 2) return { midi: [b.midi[0], b.midi[2]], durs: [2, 1] };
    return { midi: b.midi, durs: [1, 1, 1] };
  });
  const titleSuffix = tier === 1 ? ' · roots' : tier === 2 ? ' · root + fifth' : '';
  return {
    id: `chord-${uid++}`,
    type: 'chord',
    title: CHORD_BARS.map((b) => b.label).join(' – ') + titleSuffix,
    tempo,
    beatsPerBar: 3,
    bars: CHORD_BARS.length,
    notes: sequence(perBar.flatMap((b) => b.midi), perBar.flatMap((b) => b.durs)),
    chordLabels: CHORD_BARS.map((b, bar) => ({ bar, label: b.label })),
  };
}

/**
 * Scale card, by tier:
 *   1 — the first five notes up and down (A B C♯ D E D C♯ B A).
 *   2 — the full octave up and back down.
 *   3 — the full octave, then the tonic arpeggio on top.
 * Always one note per beat in 3/4, so bar counts follow the note count.
 */
function scaleExercise(tempo: number, tier: Tier): Exercise {
  let degs: number[];
  let title: string;
  if (tier === 1) {
    degs = [0, 1, 2, 3, 4, 3, 2, 1, 0]; // 9 notes -> 3 bars
    title = 'A major · first five';
  } else if (tier === 2) {
    degs = [...Array.from({ length: 8 }, (_, i) => i), 6, 5, 4, 3, 2, 1, 0]; // 15 -> 5 bars
    title = 'A major · octave';
  } else {
    // Octave up and down, then the arpeggio A C♯ E A back down to the tonic.
    degs = [
      ...Array.from({ length: 8 }, (_, i) => i),
      6, 5, 4, 3, 2, 1, 0,
      2, 4, 7, 4, 2, 0,
    ]; // 21 -> 7 bars
    title = 'A major · octave + arpeggio';
  }
  const pitches = degs.map(deg);
  return {
    id: `scale-${uid++}`,
    type: 'scale',
    title,
    tempo,
    beatsPerBar: 3,
    bars: pitches.length / 3,
    notes: sequence(pitches, Array(pitches.length).fill(1)),
  };
}

/**
 * Rhythm cards sit on concert F (F4). Note this is F♮, outside A major — the
 * key signature sharps F — so it draws with a natural sign. Chosen for the
 * player's comfort rather than to fit the harmony.
 */
export const RHYTHM_PITCH = 65; // F4 concert

/**
 * Gran Vals' own bar rhythm: two 8ths on beat 1, then quarters on beats 2 and
 * 3 (bars 1-3 of the phrase are all identical).
 */
export const GRAN_VALS_CELL = [0.5, 0.5, 1, 1];

/**
 * Rhythm card, by tier — always 3 bars of 3/4 on one pitch:
 *   1 — straight quarter notes.
 *   2 — straight eighth notes.
 *   3 — the song's own figure (two 8ths, then two quarters).
 */
function rhythmExercise(tempo: number, tier: Tier): Exercise {
  const cell = tier === 1 ? [1, 1, 1] : tier === 2 ? [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] : GRAN_VALS_CELL;
  const durs = [...cell, ...cell, ...cell];
  const titleSuffix = tier === 1 ? ' · quarters' : tier === 2 ? ' · eighths' : '';
  return {
    id: `rhythm-${uid++}`,
    type: 'rhythm',
    title: 'on concert F' + titleSuffix,
    tempo,
    beatsPerBar: 3,
    bars: 3,
    notes: sequence(Array(durs.length).fill(RHYTHM_PITCH), durs),
  };
}

/** Identity of an exercise's music (ids are always new, so compare the notes). */
export const exerciseKey = (ex: Exercise) => `${ex.type}:${ex.notes.map((n) => `${n.midi}/${n.durBeats}`).join(',')}`;

export function makeExercise(type: CardType, tempo: number, tier: Tier = 3): Exercise {
  if (type === 'chord') return chordExercise(tempo, tier);
  if (type === 'scale') return scaleExercise(tempo, tier);
  return rhythmExercise(tempo, tier);
}

// ---------- Spelling & staff ----------

export type KeySig = { name: string; accidentals: number }; // + sharps, - flats
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Concert key of all playable content: A major (Gran Vals). PRD §5. */
export const CONCERT_KEY_PC = 9; // A

/** The concert key everything is written in, for display. */
export const CONCERT_KEY_NAME = 'A';

// Every major key by pitch class, so any instrument transposition lands on a
// real key signature instead of silently falling back to C.
const KEYS_BY_PC: Record<number, KeySig> = {
  0: { name: 'C', accidentals: 0 },
  7: { name: 'G', accidentals: 1 },
  2: { name: 'D', accidentals: 2 },
  9: { name: 'A', accidentals: 3 },
  4: { name: 'E', accidentals: 4 },
  11: { name: 'B', accidentals: 5 },
  6: { name: 'F♯', accidentals: 6 },
  5: { name: 'F', accidentals: -1 },
  10: { name: 'B♭', accidentals: -2 },
  3: { name: 'E♭', accidentals: -3 },
  8: { name: 'A♭', accidentals: -4 },
  1: { name: 'D♭', accidentals: -5 },
};

export function writtenKey(offset: number, concertKey = CONCERT_KEY_PC, spelling?: 'sharps' | 'flats'): KeySig {
  // The concert key transposed by the instrument's written offset.
  const pc = (((concertKey + offset) % 12) + 12) % 12;
  if (pc === 6 && spelling === 'flats') return { name: 'G♭', accidentals: -6 };
  return KEYS_BY_PC[pc] ?? { name: 'C', accidentals: 0 };
}

// Order letters take accidentals in: sharps F C G D A E B, flats the reverse.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Which letters the key signature alters, e.g. F♯ major -> F C G D A E. */
function keyAltered(key: KeySig): Set<string> {
  const order = key.accidentals > 0 ? SHARP_ORDER : FLAT_ORDER;
  return new Set(order.slice(0, Math.abs(key.accidentals)));
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Spell a pitch using the key's own letters, so F♯ major yields E♯ rather
 * than F. A fixed pitch-class table gets this wrong in keys with 6+
 * accidentals and shifts the note onto the wrong staff line.
 */
export function noteName(midi: number, key: KeySig): string {
  const pc = ((midi % 12) + 12) % 12;
  const sharp = key.accidentals >= 0;
  const altered = keyAltered(key);
  const sign = sharp ? 1 : -1;
  const glyph = sharp ? '♯' : '♭';

  // A note in the key keeps the key's own spelling — that is what gives F♯
  // major its E♯ rather than an out-of-place F♮.
  for (const letter of Object.keys(LETTER_PC)) {
    const inKey = altered.has(letter) ? (LETTER_PC[letter] + sign + 12) % 12 : LETTER_PC[letter];
    if (inKey === pc) return altered.has(letter) ? letter + glyph : letter;
  }
  // Otherwise it is chromatic: prefer a plain natural letter (F♮ in A major),
  // then a letter a semitone away in the key's direction.
  for (const letter of Object.keys(LETTER_PC)) {
    if (LETTER_PC[letter] === pc) return letter;
  }
  for (const letter of Object.keys(LETTER_PC)) {
    if ((LETTER_PC[letter] + sign + 12) % 12 === pc) return letter + glyph;
  }
  return (sharp ? SHARP_NAMES : FLAT_NAMES)[pc];
}

/** Diatonic staff step: 0 = E4 (bottom line), each +1 is one line/space up. */
/**
 * The accidental this note needs drawn, given what the key signature already
 * applies to its letter — or '' when the key signature covers it. A natural
 * is needed when the key alters the letter but this note does not use that
 * alteration (e.g. F♮ in A major).
 */
export function accidentalFor(midi: number, key: KeySig): '' | '♯' | '♭' | '♮' {
  const name = noteName(midi, key);
  const letter = name[0];
  const mark = name.slice(1) as '' | '♯' | '♭';
  const alteredByKey = keyAltered(key).has(letter);
  const keyMark = key.accidentals > 0 ? '♯' : '♭';
  if (alteredByKey) return mark === keyMark ? '' : mark || '♮';
  return mark;
}

export function staffStep(midi: number, key: KeySig): number {
  const name = noteName(midi, key);
  const letter = LETTERS.indexOf(name[0]);
  let octave = Math.floor(midi / 12) - 1;
  // B♯ sounds in the octave above its letter (and C♭ the octave below), so
  // derive the octave from the letter rather than the sounding pitch.
  const pc = ((midi % 12) + 12) % 12;
  const letterPc = LETTER_PC[name[0]];
  if (letterPc === 11 && pc === 0) octave -= 1; // B♯ spelled below the C it sounds
  if (letterPc === 0 && pc === 11) octave += 1; // C♭ spelled above the B it sounds
  const diatonic = octave * 7 + letter;
  const e4 = 4 * 7 + 2;
  return diatonic - e4;
}

// Full orders so keys past 5 accidentals render correctly (alto sax reads
// Gran Vals in F♯ major = 6 sharps).
export const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4]; // F C G D A E B on treble staff
export const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1]; // B E A D G C F
