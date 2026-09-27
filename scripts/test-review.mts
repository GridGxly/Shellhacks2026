// Exercises the review/playback logic without a browser or a microphone:
// which misses become stops, and how playExercise would segment a take.
//   npx tsx scripts/test-review.mts
import { buildReview } from '../lib/training-core';
import type { NoteResult } from '../lib/mic';
import type { TrainingState } from '../lib/training-types';

let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};

const TEMPO = 80, BEATS = 4;
const music = (id: string) => ({
  id, title: 't', type: 'scale' as const, tempo: TEMPO, beatsPerBar: BEATS, bars: 1,
  notes: [69, 71, 73, 74].map((midi, i) => ({ midi, startBeat: i, durBeats: 1 })),
});
const hit = (i: number, midi: number, off: number | null = 0): NoteResult => ({ index: i, status: 'hit', playedMidi: midi, onsetOffsetMs: off });
const wrong = (i: number, midi: number, off: number | null = 0): NoteResult => ({ index: i, status: 'wrong', playedMidi: midi, onsetOffsetMs: off });
const silent = (i: number): NoteResult => ({ index: i, status: 'silent', playedMidi: null, onsetOffsetMs: null });

function makeState(perExercise: NoteResult[][]): TrainingState {
  const exercises = perExercise.map((_, i) => ({ id: `e${i + 1}`, role: (i === 3 ? 'final' : 'drill') as 'final' | 'drill', goal: 'g', music: music(`e${i + 1}`) }));
  return {
    day: 'd', resetsAt: 0, serverNow: 0, revision: 0, status: 'complete', nextIndex: 4, claimed: false, pendingBuff: false,
    plan: { id: 'p', source: 'offline', regiment: { mode: 'custom', instrument: 'trumpet', concertKey: 9, spelling: 'sharps', focus: 'mixed', tempo: TEMPO }, focusSummary: 's', exercises },
    receipts: perExercise.map((notes, i) => ({ exerciseId: `e${i + 1}`, attemptId: 'a', hits: notes.filter(n => n.status === 'hit').length, total: notes.length, notes, simulated: false, feedback: { source: 'offline', castor: '', pollux: '' }, completedAt: 0 })),
    weaknesses: { pitches: [], rhythm: { early: 0, steady: 0, late: 0, unknown: 0 }, sources: { adventure: 0, tavern: 0, training: 0 } },
  } as TrainingState;
}

/** Mirrors playExercise: segments of audio, with a pause after each miss. */
function segments(state: TrainingState, exerciseIndex: number) {
  const summary = buildReview(state);
  const exercise = state.plan!.exercises[exerciseIndex];
  const endBeat = Math.max(...exercise.music.notes.map(n => n.startBeat + n.durBeats));
  const marks = summary.stops.filter(s => s.exerciseIndex === exerciseIndex);
  const out: string[] = [];
  let fromBeat = 0;
  for (const mark of marks) {
    const untilBeat = mark.startBeat + 1;
    if (untilBeat > fromBeat) out.push(`play ${fromBeat}-${untilBeat}`);
    out.push(`PAUSE(${mark.speaker}/${mark.reason})`);
    fromBeat = untilBeat;
  }
  if (endBeat > fromBeat) out.push(`play ${fromBeat}-${endBeat}`);
  return out;
}

console.log('--- green notes never interrupt ---');
const allGreenBadTiming = makeState([
  [hit(0, 69, -400), hit(1, 71, 350), hit(2, 73, -260), hit(3, 74, 500)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
]);
check('clean-but-late take yields no stops', buildReview(allGreenBadTiming).stops.length, 0);
check('  and plays straight through', segments(allGreenBadTiming, 0), ['play 0-4']);
check('untimed hits (null offset) yield no stops', buildReview(makeState([
  [hit(0, 69, null), hit(1, 71, null), hit(2, 73, null), hit(3, 74, null)], [], [], [],
])).stops.length, 0);

console.log('\n--- real misses still stop ---');
const mixed = makeState([
  [hit(0, 69), wrong(1, 72), hit(2, 73, 300), silent(3)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],
]);
check('wrong + silent produce two stops', buildReview(mixed).stops.map(s => `${s.speaker}/${s.reason}`), ['castor/pitch', 'castor/silent']);
check('  green note at 300ms is not among them', buildReview(mixed).stops.some(s => s.noteIndex === 2), false);
check('  segmentation pauses after each miss', segments(mixed, 0), ['play 0-2', 'PAUSE(castor/pitch)', 'play 2-4', 'PAUSE(castor/silent)']);

console.log('\n--- wrong-but-right-pitch is a timing stop ---');
const lateWrong = makeState([[hit(0, 69), hit(1, 71), hit(2, 73), wrong(3, 74, -300)], [], [], []]);
check('graded wrong with correct pitch -> pollux/timing', buildReview(lateWrong).stops.map(s => `${s.speaker}/${s.reason}`), ['pollux/timing']);

console.log('\n--- ordering: worst exercise first ---');
const ordering = makeState([
  [hit(0, 69), hit(1, 71), hit(2, 73), wrong(3, 75)],                 // 3/4
  [wrong(0, 70), wrong(1, 72), wrong(2, 74), wrong(3, 75)],           // 0/4 worst
  [hit(0, 69), hit(1, 71), wrong(2, 74), wrong(3, 75)],               // 2/4
  [hit(0, 69), hit(1, 71), hit(2, 73), hit(3, 74)],                   // clean
]);
check('stops run worst exercise first', [...new Set(buildReview(ordering).stops.map(s => s.exerciseId))], ['e2', 'e3', 'e1']);

console.log('\n--- demo takes are excluded ---');
const demo = makeState([[wrong(0, 70), wrong(1, 72), silent(2), silent(3)], [], [], []]);
demo.receipts[0].simulated = true;
check('simulated take yields no stops', buildReview(demo).stops.length, 0);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
