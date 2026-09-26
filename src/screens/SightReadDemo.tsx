/**
 * SightReadDemo.tsx — a standalone "read the sheet music" demo (concept preview).
 *
 * This is NOT the real combat screen. It's a focused sandbox to feel the core
 * loop: real sheet music, a cursor that sweeps in tempo, and each note flashing
 * green/red as it's "played". The grading here is FAKE (a coin flip per note) so
 * we can see the whole experience before the mic/pitch backend is wired in.
 *
 * When the backend is ready, the only change is the `gradeNote` prop below:
 * swap the coin flip for "did the player actually hit note N?".
 */

import { useEffect, useState } from 'react';
import { Staff } from '../notation/Staff';
import type { Exercise } from '../types';
import type { KeyId } from '../config';
import { COUNT_IN_BEATS, INSTRUMENT_KEYS, PASS_THRESHOLD } from '../config';

// A short 3-bar melody in C major, stored in CONCERT pitch (PRD §5).
// Try editing these numbers — the staff, cursor, and grading all follow.
const DEMO_EXERCISE: Exercise = {
  id: 'demo-1',
  tempo: 90,
  timeSig: [4, 4],
  notes: [
    { midi: 60, startBeat: 0, durBeats: 1 }, // C
    { midi: 62, startBeat: 1, durBeats: 1 }, // D
    { midi: 64, startBeat: 2, durBeats: 1 }, // E
    { midi: 65, startBeat: 3, durBeats: 1 }, // F
    { midi: 67, startBeat: 4, durBeats: 1 }, // G
    { midi: 69, startBeat: 5, durBeats: 1 }, // A
    { midi: 67, startBeat: 6, durBeats: 1 }, // G
    { midi: 65, startBeat: 7, durBeats: 1 }, // F
    { midi: 64, startBeat: 8, durBeats: 1 }, // E
    { midi: 62, startBeat: 9, durBeats: 1 }, // D
    { midi: 60, startBeat: 10, durBeats: 2 }, // C (half note)
  ],
};

// How often the fake player "hits" a note. Lower it to see more red.
const FAKE_ACCURACY = 0.82;

type Phase = 'idle' | 'countIn' | 'playing' | 'done';

export function SightReadDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [countLabel, setCountLabel] = useState('');
  const [instrumentKey, setInstrumentKey] = useState<KeyId>('C');

  // Live tallies for the HUD.
  const [correct, setCorrect] = useState(0);
  const [graded, setGraded] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  const totalNotes = DEMO_EXERCISE.notes.length;
  const msPerBeat = 60000 / DEMO_EXERCISE.tempo;

  // Count-in: tick COUNT_IN_BEATS times, then start the cursor.
  useEffect(() => {
    if (phase !== 'countIn') return;
    let beat = COUNT_IN_BEATS;
    setCountLabel(String(beat));
    const id = setInterval(() => {
      beat -= 1;
      if (beat <= 0) {
        clearInterval(id);
        setCountLabel('');
        setPhase('playing');
      } else {
        setCountLabel(String(beat));
      }
    }, msPerBeat);
    return () => clearInterval(id);
  }, [phase, msPerBeat]);

  function start() {
    setCorrect(0);
    setGraded(0);
    setCombo(0);
    setMaxCombo(0);
    setPhase('countIn');
  }

  // The grading seam. The real mic/pitch backend replaces this: return the MIDI
  // pitch the player ACTUALLY played (or null for silence). For now we fake it —
  // usually the right note, sometimes a nearby wrong pitch so you can see the
  // ghost land on the actual wrong note.
  function getPlayed(index: number): number | null {
    const expected = DEMO_EXERCISE.notes[index]?.midi ?? null;
    if (expected == null) return null;
    if (Math.random() < FAKE_ACCURACY) return expected; // hit
    // Miss: play a nearby wrong pitch, 1–4 semitones off (never 0).
    const off = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 4));
    return expected + off;
  }

  // Update the HUD as each note is graded.
  function onNoteGraded(_index: number, wasCorrect: boolean) {
    setGraded((g) => g + 1);
    if (wasCorrect) {
      setCorrect((c) => c + 1);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
    } else {
      setCombo(0);
    }
  }

  const accuracy = graded === 0 ? 0 : correct / graded;
  const passed = graded === totalNotes && accuracy >= PASS_THRESHOLD;

  return (
    <div className="demo-screen">
      <header className="demo-head">
        <h1>Sight-Reading Spire — reading demo</h1>
        <p className="demo-sub">
          {DEMO_EXERCISE.tempo} BPM · reading in {INSTRUMENT_KEYS[instrumentKey].label}
        </p>
      </header>

      {/* Instrument key: shows the same music transposed to written pitch (PRD §5). */}
      <div className="demo-keys">
        <span className="demo-keys-label">Instrument:</span>
        {(Object.keys(INSTRUMENT_KEYS) as KeyId[]).map((k) => (
          <button
            key={k}
            className={k === instrumentKey ? 'key-btn active' : 'key-btn'}
            disabled={phase === 'countIn' || phase === 'playing'}
            onClick={() => setInstrumentKey(k)}
          >
            {k}
          </button>
        ))}
      </div>

      {/* HUD: the rhythm-game feedback. */}
      <div className="demo-hud">
        <div className="hud-stat">
          <span className="hud-num">{Math.round(accuracy * 100)}%</span>
          <span className="hud-cap">accuracy</span>
        </div>
        <div className="hud-stat">
          <span className="hud-num">{combo}</span>
          <span className="hud-cap">combo</span>
        </div>
        <div className="hud-stat">
          <span className="hud-num">
            {correct}/{totalNotes}
          </span>
          <span className="hud-cap">hits</span>
        </div>
      </div>

      {/* Accuracy meter: fills on hits, drops on misses. The notch marks the
          PASS_THRESHOLD you have to clear; the bar turns green once you're over it. */}
      <div className="acc-bar">
        <div
          className={accuracy >= PASS_THRESHOLD ? 'acc-fill over' : 'acc-fill'}
          style={{ width: `${accuracy * 100}%` }}
        />
        <div className="acc-threshold" style={{ left: `${PASS_THRESHOLD * 100}%` }} />
        <span className="acc-threshold-label" style={{ left: `${PASS_THRESHOLD * 100}%` }}>
          {Math.round(PASS_THRESHOLD * 100)}%
        </span>
      </div>

      {/* The staff, with the count-in / result overlay on top. */}
      <div className="demo-stage">
        <Staff
          exercise={DEMO_EXERCISE}
          instrumentKey={instrumentKey}
          playing={phase === 'playing'}
          getPlayed={getPlayed}
          onNoteGraded={onNoteGraded}
          onFinished={() => setPhase('done')}
        />

        {phase === 'countIn' && <div className="demo-overlay count-in">{countLabel}</div>}

        {phase === 'done' && (
          <div className={`demo-overlay result ${passed ? 'pass' : 'fail'}`}>
            {passed ? 'HIT!' : 'MISSED'}
            <span className="result-sub">
              {Math.round(accuracy * 100)}% · best combo {maxCombo}
            </span>
          </div>
        )}
      </div>

      <div className="demo-controls">
        <button onClick={start} disabled={phase === 'countIn' || phase === 'playing'}>
          {phase === 'idle' ? 'Play ▶' : 'Play again ▶'}
        </button>
      </div>
    </div>
  );
}
