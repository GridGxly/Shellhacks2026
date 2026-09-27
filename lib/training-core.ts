import { IGNORE_OCTAVE } from './config';
import { isInt, isObject } from './validation';
import { INSTRUMENTS, type InstrumentId } from './content';
import type { NoteResult } from './mic';
import { noteName, writtenKey, type Exercise, type Note } from './music';
import type { PerformanceSource, ReviewStop, ReviewSummary, TrainingFeedback, TrainingPlan, TrainingRegiment, TrainingResult, TrainingState, WeaknessSummary } from './training-types';

export { TRAINING_BUFF_TIPS } from './config'; // kept here for existing imports
export const TRAINING_START_DELAY_MS = 4000;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const nextUtcMidnight = (now = Date.now()) => (Math.floor(now / 86400000) + 1) * 86400000;
const object = isObject;
const integer = (v: unknown, lo: number, hi: number) => isInt(v, lo, hi);
const plain = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[<>\u0000-\u001f]/.test(v);
const pc = (m: number) => ((m % 12) + 12) % 12;
const id = () => globalThis.crypto.randomUUID();
export const defaultRegiment = (instrument: InstrumentId = 'trumpet'): TrainingRegiment => ({ mode: 'recommended', instrument, concertKey: 9, spelling: 'sharps', focus: 'mixed', tempo: 80 });
export function validateRegiment(v: unknown): TrainingRegiment | null {
  if (!object(v) || !['recommended', 'custom'].includes(String(v.mode)) || !INSTRUMENTS.some(i => i.id === v.instrument) || !integer(v.concertKey, 0, 11) || !['sharps', 'flats'].includes(String(v.spelling)) || !['pitch', 'rhythm', 'mixed'].includes(String(v.focus)) || !integer(v.tempo, 60, 120)) return null;
  return { mode: v.mode as TrainingRegiment['mode'], instrument: v.instrument as InstrumentId, concertKey: v.concertKey, spelling: v.spelling as TrainingRegiment['spelling'], focus: v.focus as TrainingRegiment['focus'], tempo: v.tempo };
}
export const emptyWeaknesses = (): WeaknessSummary => ({ pitches: Array.from({ length: 12 }, () => ({ attempts: 0, hits: 0 })), rhythm: { early: 0, steady: 0, late: 0, unknown: 0 }, sources: { adventure: 0, tavern: 0, training: 0 } });
export function validateWeaknesses(v: unknown): WeaknessSummary | null {
  if (!object(v) || !Array.isArray(v.pitches) || v.pitches.length !== 12 || !object(v.rhythm) || !object(v.sources)) return null;
  if (v.pitches.some(p => !object(p) || !integer(p.attempts, 0, 100000000) || !integer(p.hits, 0, Number(p.attempts)))) return null;
  for (const k of ['early', 'steady', 'late', 'unknown']) if (!integer(v.rhythm[k], 0, 100000000)) return null;
  for (const k of ['adventure', 'tavern', 'training']) if (!integer(v.sources[k], 0, 100000000)) return null;
  return structuredClone(v) as unknown as WeaknessSummary;
}
export function mergePerformance(weaknesses: WeaknessSummary, exercise: Exercise, notes: NoteResult[], source: PerformanceSource, simulated = false): WeaknessSummary {
  const next = structuredClone(weaknesses);
  if (simulated) return next;
  for (const result of notes) {
    const bucket = next.pitches[pc(exercise.notes[result.index].midi)];
    bucket.attempts++; if (result.status === 'hit') bucket.hits++;
    const offset = result.onsetOffsetMs;
    next.rhythm[offset === null ? 'unknown' : offset < -60 ? 'early' : offset > 60 ? 'late' : 'steady']++;
  }
  next.sources[source]++;
  return next;
}
export function weaknessFocus(w: WeaknessSummary): { pitch: number | null; timing: boolean; summary: string } {
  const weak = w.pitches.map((p, pitch) => ({ ...p, pitch })).filter(p => p.attempts >= 6).sort((a, b) => a.hits / a.attempts - b.hits / b.attempts)[0];
  const timing = w.rhythm.early + w.rhythm.late >= 6 && w.rhythm.early + w.rhythm.late > w.rhythm.steady;
  return { pitch: weak && weak.hits / weak.attempts < .85 ? weak.pitch : null, timing, summary: timing ? 'Build a steadier pulse, then bring the whole phrase together.' : weak && weak.hits / weak.attempts < .85 ? 'Revisit your least consistent notes, then connect them into a phrase.' : 'Build clear notes and a steady pulse in a balanced starter set.' };
}
export function exerciseDurationMs(ex: Exercise): number {
  return Math.max(...ex.notes.map(n => n.startBeat + n.durBeats)) * 60000 / ex.tempo;
}
export function validateExercise(v: unknown): Exercise | null {
  if (!object(v) || !plain(v.id, 80) || !plain(v.title, 100) || !['scale', 'rhythm', 'chord', 'encore'].includes(String(v.type)) || !integer(v.tempo, 40, 240) || !integer(v.beatsPerBar, 2, 4) || !integer(v.bars, 1, 8) || !Array.isArray(v.notes) || v.notes.length < 1 || v.notes.length > 64) return null;
  let end = 0;
  const notes: Note[] = [];
  for (const n of v.notes) {
    if (!object(n) || !integer(n.midi, 36, 96) || typeof n.startBeat !== 'number' || typeof n.durBeats !== 'number' || !Number.isFinite(n.startBeat) || !Number.isFinite(n.durBeats) || n.startBeat < end - .001 || n.durBeats < .25 || n.durBeats > 8 || n.startBeat < 0 || n.startBeat + n.durBeats > v.bars * v.beatsPerBar + .001) return null;
    notes.push({ midi: n.midi, startBeat: n.startBeat, durBeats: n.durBeats }); end = n.startBeat + n.durBeats;
  }
  return { id: v.id, title: v.title, type: v.type as Exercise['type'], tempo: v.tempo, beatsPerBar: v.beatsPerBar, bars: v.bars, notes };
}
export function validateTrainingResults(ex: Exercise, instrument: InstrumentId, value: unknown): NoteResult[] | null {
  if (!Array.isArray(value) || value.length !== ex.notes.length) return null;
  const shift = INSTRUMENTS.find(i => i.id === instrument)?.shift;
  if (shift === undefined) return null;
  const out: NoteResult[] = [];
  for (let i = 0; i < value.length; i++) {
    const r = value[i];
    if (!object(r) || r.index !== i || !['hit', 'wrong', 'silent'].includes(String(r.status)) || (r.playedMidi !== null && !integer(r.playedMidi, 0, 127)) || (r.onsetOffsetMs !== null && (typeof r.onsetOffsetMs !== 'number' || !Number.isFinite(r.onsetOffsetMs) || Math.abs(r.onsetOffsetMs) > 2000))) return null;
    const expected = ex.notes[i].midi + shift;
    const match = r.playedMidi !== null && (IGNORE_OCTAVE ? pc(Number(r.playedMidi)) === pc(expected) : r.playedMidi === expected);
    if ((r.status === 'silent') !== (r.playedMidi === null) || (r.status === 'silent' && r.onsetOffsetMs !== null) || (r.status === 'hit') !== match) return null;
    out.push({ index: i, status: r.status as NoteResult['status'], playedMidi: r.playedMidi as number | null, onsetOffsetMs: r.onsetOffsetMs as number | null });
  }
  return out;
}
export function makeOfflinePlan(regiment: TrainingRegiment, weaknesses = emptyWeaknesses(), seed = id()): TrainingPlan {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const focus = weaknessFocus(weaknesses);
  const chosen = { ...regiment };
  if (chosen.mode === 'recommended') { if (focus.pitch !== null) chosen.concertKey = focus.pitch; chosen.focus = focus.timing ? 'rhythm' : focus.pitch !== null ? 'pitch' : 'mixed'; }
  const tonic = 60 + chosen.concertKey;
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  const rotate = (Math.abs(h) + (focus.pitch ?? 0)) % 3;
  const motifs = [[0, 1, 2, 1], [0, 2, 4, 2], [4, 3, 2, 0]];
  const rhythm = chosen.focus === 'rhythm' ? [1, .5, .5, 2] : [1, 1, 1, 1];
  const music = (degrees: number[], durations: number[], exerciseId: string, bars: number): Exercise => {
    let beat = 0;
    return { id: exerciseId, type: chosen.focus === 'rhythm' ? 'rhythm' : 'scale', title: bars === 4 ? 'Bring it together' : 'A clear phrase', tempo: chosen.tempo, beatsPerBar: 4, bars, notes: degrees.map((d, i) => { const note = { midi: tonic + scale[d], startBeat: beat, durBeats: durations[i] }; beat += note.durBeats; return note; }) };
  };
  const planId = seed;
  const exercises = Array.from({ length: 3 }, (_, i) => {
    const motif = motifs[(i + rotate) % 3];
    const exerciseId = `${planId}-${i}`;
    return { id: exerciseId, role: 'drill' as const, goal: ['Find each note with a relaxed attack.', 'Keep the pulse steady between notes.', 'Connect the notes into one smooth phrase.'][i], music: music([...motif, ...motif], [...rhythm, ...rhythm], exerciseId, 2) };
  });
  // The final is made from material already previewed and practised.
  const finalId = `${planId}-3`;
  const finalNotes = [0, 1, 2, 0].flatMap((drill, bar) => exercises[drill].music.notes.filter(n => n.startBeat < 4).map(n => ({ ...n, startBeat: n.startBeat + bar * 4 })));
  const final = { id: finalId, role: 'final' as const, goal: 'Join the practised motifs into your final phrase.', music: { ...exercises[0].music, id: finalId, title: 'Bring it together', bars: 4, notes: finalNotes } };
  return { id: planId, source: 'offline', fallbackReason: 'not_configured', regiment: chosen, focusSummary: chosen.mode === 'recommended' ? focus.summary : `Your chosen key, pulse, and focus. ${focus.timing ? 'Keep a close ear on the spaces between notes.' : 'Clear attacks help connect each practised note.'}`, exercises: [...exercises, final] };
}
export function validatePlan(v: unknown, regiment: TrainingRegiment): TrainingPlan | null {
  if (!object(v) || !plain(v.id, 64) || !plain(v.focusSummary, 180) || !Array.isArray(v.exercises) || v.exercises.length !== 4 || !['gemini', 'offline'].includes(String(v.source))) return null;
  const exercises: TrainingPlan['exercises'] = [];
  const scalePcs = [0, 2, 4, 5, 7, 9, 11].map(n => pc(n + regiment.concertKey));
  for (let i = 0; i < 4; i++) {
    const raw = v.exercises[i]; if (!object(raw) || !plain(raw.goal, 120)) return null;
    const ex = validateExercise(raw.music); const bars = i === 3 ? 4 : 2;
    if (!ex || ex.bars !== bars || ex.beatsPerBar !== 4 || ex.tempo !== regiment.tempo || ex.notes.length < 3 || ex.notes.length > 32 || ex.notes.some(n => n.midi < 60 || n.midi > 84 || !scalePcs.includes(pc(n.midi)) || !Number.isInteger(n.startBeat * 2) || !Number.isInteger(n.durBeats * 2) || n.durBeats > 4)) return null;
    const eid = `${v.id}-${i}`;
    exercises.push({ id: eid, role: i === 3 ? 'final' : 'drill', goal: raw.goal, music: { ...ex, id: eid } });
  }
  const practiced = new Set(exercises.slice(0, 3).flatMap(e => e.music.notes.map(n => `${n.midi}:${n.durBeats}`)));
  if (exercises[3].music.notes.some(n => !practiced.has(`${n.midi}:${n.durBeats}`))) return null;
  return { id: v.id, source: v.source as TrainingPlan['source'], regiment, focusSummary: v.focusSummary, exercises, ...(v.source === 'offline' ? { fallbackReason: ['not_configured', 'unavailable', 'invalid_response'].includes(String(v.fallbackReason)) ? v.fallbackReason as TrainingPlan['fallbackReason'] : 'not_configured' } : {}) };
}
const pick = <T,>(lines: T[]) => lines[Math.floor(Math.random() * lines.length)];
/** The twins' built-in coaching, in their own voices: Castor on pitch, Pollux on pulse. */
export function offlineFeedback(ex: Exercise, notes: NoteResult[], final = false): TrainingFeedback {
  const total = notes.length;
  const hits = notes.filter(n => n.status === 'hit').length;
  const silent = notes.filter(n => n.status === 'silent').length;
  const offsets = notes.flatMap(n => n.onsetOffsetMs === null ? [] : [n.onsetOffsetMs]);
  const average = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null;
  const across = final ? 'Across the whole set, ' : '';
  const castor = hits === total ? pick([
    `${across}every pitch rang true. That is how a prince would play it.`,
    `${across}clean from the first note to the last. The Canon itself approves.`,
    `${hits} of ${total}, all true. Keep that ear exactly as it is.`,
  ]) : silent > 0 ? pick([
    `${across}${silent} ${silent === 1 ? 'note' : 'notes'} never reached me. Give each one a clear start, and breathe before the phrase.`,
    `Some notes went missing, ${silent} of them. Play a touch louder and commit to every start.`,
  ]) : hits / Math.max(1, total) >= 0.7 ? pick([
    `${across}${hits} of ${total} true. Take the stray notes slowly, then weave them back in.`,
    `Nearly there, ${hits} of ${total}. Hum each wandering note once before you play it.`,
  ]) : pick([
    `${across}only ${hits} of ${total} landed. Slow it down: accuracy first, speed later.`,
    `The pitches wandered today, ${hits} of ${total}. Try the phrase at half speed and listen for each landing.`,
  ]);
  const pollux = average === null ? pick([
    `I couldn't catch your attacks. Count four out loud at ${ex.tempo} and come in strong.`,
    `Too quiet to time, bard. Give me a firm start on every note at ${ex.tempo}.`,
  ]) : average < -60 ? pick([
    'You jumped the gun! Let the beat land first, then strike.',
    'Too eager. Wait for the beat the way a boxer waits for an opening.',
  ]) : average > 60 ? pick([
    'You came in behind the beat. Breathe before it, so the note lands on it.',
    'A step slow on the attacks. Have your breath ready one beat early.',
  ]) : pick([
    "Right on the pulse. That's footwork even my brother can't match.",
    'Your timing held tight. Now keep the gaps between notes just as even.',
  ]);
  return { source: 'offline', castor, pollux };
}
function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/**
 * Turn measured misses into the review's stops. Castor speaks to pitch (he
 * owns pitch in the twins' feedback), Pollux to pulse. Every line is derived
 * from NoteResult data only — never from audio the server cannot hear.
 */
export function buildReview(state: TrainingState): ReviewSummary {
  const plan = state.plan;
  if (!plan) return { stops: [], perExercise: [] };
  const inst = INSTRUMENTS.find(i => i.id === plan.regiment.instrument);
  const shift = inst?.shift ?? 0, offset = inst?.writtenOffset ?? 0;
  const key = writtenKey(offset, plan.regiment.concertKey, plan.regiment.spelling);
  // Staff.tsx spells written pitch as concert + shift + writtenOffset, while
  // grade() already returns playedMidi in shifted space. Name both the same way.
  const writtenExpected = (midi: number) => noteName(midi + shift + offset, key);
  const writtenPlayed = (midi: number) => noteName(midi + offset, key);
  const perExercise: ReviewSummary['perExercise'] = [];
  const stops: ReviewStop[] = [];
  for (const [exerciseIndex, exercise] of plan.exercises.entries()) {
    const receipt = state.receipts.find(r => r.exerciseId === exercise.id);
    if (!receipt) continue;
    perExercise.push({ exerciseId: exercise.id, exerciseIndex, role: exercise.role, hits: receipt.hits, total: receipt.total });
    if (receipt.simulated) continue; // demo takes are not the player's playing
    for (const result of receipt.notes) {
      const note = exercise.music.notes[result.index];
      if (!note) continue;
      const beat = note.startBeat;
      const where = `bar ${Math.floor(beat / exercise.music.beatsPerBar) + 1}, beat ${Math.floor(beat % exercise.music.beatsPerBar) + 1}`;
      const at = { exerciseId: exercise.id, exerciseIndex, noteIndex: result.index, startBeat: beat };
      if (result.status === 'silent') {
        stops.push({ ...at, speaker: 'castor', reason: 'silent', line: `At ${where} the ${writtenExpected(note.midi)} did not sound. Take a full breath and start the note firmly.` });
        continue;
      }
      // A note the staff shows green is a hit: never interrupt playback for it,
      // however early or late the attack was. Only wrong notes stop the take.
      if (result.status !== 'wrong') continue;
      // playedMidi is shifted space; the written note is concert + shift.
      const apart = result.playedMidi === null ? 0 : result.playedMidi - (note.midi + shift);
      const folded = IGNORE_OCTAVE ? apart - 12 * Math.round(apart / 12) : apart;
      if (folded !== 0) {
        const distance = Math.abs(folded) === 1 ? 'a semitone' : `${Math.abs(folded)} semitones`;
        stops.push({ ...at, speaker: 'castor', reason: 'pitch', line: `At ${where} you played ${writtenPlayed(result.playedMidi!)} instead of ${writtenExpected(note.midi)} — ${distance} ${folded > 0 ? 'above' : 'below'}. Hear the ${writtenExpected(note.midi)} before you play it.` });
      } else if (result.onsetOffsetMs !== null && Math.abs(result.onsetOffsetMs) > 120) {
        // Right pitch but graded wrong: the attack is what went astray.
        const early = result.onsetOffsetMs < 0;
        stops.push({ ...at, speaker: 'pollux', reason: 'timing', line: `At ${where} your ${ordinal(result.index + 1)} note came in ${Math.round(Math.abs(result.onsetOffsetMs))} milliseconds ${early ? 'early' : 'late'}. ${early ? 'Let the beat arrive before you start.' : 'Prepare the breath a moment sooner.'}` });
      }
    }
  }
  // Worst exercise first, then in playing order inside each exercise.
  const accuracy = new Map(perExercise.map(e => [e.exerciseId, e.total ? e.hits / e.total : 1]));
  stops.sort((a, b) => (accuracy.get(a.exerciseId)! - accuracy.get(b.exerciseId)!) || a.exerciseIndex - b.exerciseIndex || a.startBeat - b.startBeat);
  return { stops, perExercise };
}

export function newGuestTraining(now = Date.now(), pendingBuff = false, weaknesses = emptyWeaknesses()): TrainingState {
  return { day: utcDay(now), resetsAt: nextUtcMidnight(now), serverNow: now, revision: 0, plan: null, status: 'ready', nextIndex: 0, receipts: [], claimed: false, pendingBuff, weaknesses };
}
export function refreshGuestTraining(state: TrainingState, now = Date.now()): TrainingState {
  return state.day === utcDay(now) ? { ...state, serverNow: now } : newGuestTraining(now, state.pendingBuff, state.weaknesses);
}
export function guestStartPlan(state: TrainingState, plan: TrainingPlan, now = Date.now()): TrainingState {
  const fresh = refreshGuestTraining(state, now);
  return { ...fresh, plan, status: 'ready', nextIndex: 0, receipts: [], activeAttempt: undefined, finalFeedback: undefined, revision: fresh.revision + 1 };
}
export function guestBegin(state: TrainingState, now = Date.now()): TrainingState {
  if (state.day !== utcDay(now) || !state.plan || state.nextIndex >= 4) throw new Error('Refresh today’s practice before starting.');
  return { ...state, serverNow: now, status: 'active', activeAttempt: { id: id(), exerciseId: state.plan.exercises[state.nextIndex].id, startAt: now + TRAINING_START_DELAY_MS }, revision: state.revision + 1 };
}
export function guestSubmit(state: TrainingState, result: TrainingResult, now = Date.now()): TrainingState {
  const ex = state.plan?.exercises[state.nextIndex];
  if (state.day !== utcDay(now) || !ex || result.exerciseId !== ex.id || !state.activeAttempt || state.activeAttempt.id !== result.attemptId || typeof result.simulated !== 'boolean') throw new Error('This exercise is no longer active.');
  const notes = validateTrainingResults(ex.music, state.plan!.regiment.instrument, result.notes); if (!notes) throw new Error('Invalid practice results.');
  const receipt = { exerciseId: ex.id, attemptId: result.attemptId, notes, simulated: result.simulated, hits: notes.filter(n => n.status === 'hit').length, total: notes.length, feedback: offlineFeedback(ex.music, notes), completedAt: now };
  const receipts = [...state.receipts, receipt]; const complete = receipts.length === 4;
  return { ...state, activeAttempt: undefined, status: complete ? 'complete' : 'ready', nextIndex: state.nextIndex + 1, receipts, revision: state.revision + 1, serverNow: now, weaknesses: mergePerformance(state.weaknesses, ex.music, notes, 'training', result.simulated), ...(complete ? { finalFeedback: offlineFeedback(ex.music, receipts.flatMap(r => r.notes), true) } : {}) };
}
export function guestClaim(state: TrainingState, now = Date.now()): TrainingState {
  if (state.day !== utcDay(now) || state.status !== 'complete' || state.receipts.length !== 4) throw new Error('Finish today’s set before claiming.');
  if (state.claimed) return state;
  if (state.pendingBuff) throw new Error('Use your banked training tips on a new climb first.');
  return { ...state, claimed: true, pendingBuff: true, serverNow: now, revision: state.revision + 1 };
}
