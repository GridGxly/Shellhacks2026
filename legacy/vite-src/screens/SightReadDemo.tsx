/**
 * SightReadDemo.tsx — a standalone "read the sheet music" demo (concept preview).
 *
 * Two grading modes:
 *   - Simulated (default): a coin flip per note, so you can see the loop with no mic.
 *   - Live mic: uses the pitch-detection backend (audio/pitch.ts -> mic.js). The
 *     ghost note lands on the pitch you ACTUALLY play into the mic.
 *
 * The grading seam is `getPlayed(index)`: return the concert-pitch MIDI the player
 * played for that note (or null for silence). Live mode reads the mic; sim fakes it.
 */

import { useEffect, useRef, useState } from 'react';
import { Staff } from '../notation/Staff';
import {
  COUNT_IN_BEATS,
  INSTRUMENT_KEYS,
  MIN_PITCH_COVERAGE,
  PASS_THRESHOLD,
  PITCH_TOLERANCE_CENTS,
} from '../config';
import type { KeyId } from '../config';
import { GRAN_VALS_ULTIMATE } from '../content/levels';
import { startMic } from '../audio/pitch';
import type { MicHandle, PitchReading } from '../audio/pitch';

// The real main song (Gran Vals / Nokia tune) from the merged content — concert
// pitch, A major, 3/4, 200 BPM, 12 bars. Transposed for display per instrument.
const SONG = GRAN_VALS_ULTIMATE;

// How often the fake player "hits" a note (simulated mode). Lower = more red.
const FAKE_ACCURACY = 0.82;

// Ignore the first part of each note's window: that's where the previous note
// is still ringing / the new one is still attacking.
const SKIP_ATTACK = 0.2;
// Need at least this many mic readings in a note's window, or it counts as silent.
const MIN_READINGS = 2;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(m: number): string {
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

type Phase = 'idle' | 'countIn' | 'playing' | 'done';

export function SightReadDemo() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [countLabel, setCountLabel] = useState('');
  const [instrumentKey, setInstrumentKey] = useState<KeyId>('C');
  const [liveMic, setLiveMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [heard, setHeard] = useState<number | null>(null); // latest detected MIDI, for the readout

  // Live tallies for the HUD.
  const [correct, setCorrect] = useState(0);
  const [graded, setGraded] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // Mic state kept in refs so getPlayed can read it synchronously.
  const micHandleRef = useRef<MicHandle | null>(null);
  // Recent detected pitches. midi is FRACTIONAL (69.3 = A4, 30 cents sharp) so we
  // can measure how close a note was, not just which semitone it rounds to.
  const readingsRef = useRef<{ midi: number; time: number }[]>([]);

  const totalNotes = SONG.notes.length;
  const msPerBeat = 60000 / SONG.tempo;

  // Continuously record what the mic hears.
  function handleReading(r: PitchReading) {
    if (r.midi == null) return;
    const m = Math.round(r.midi);
    const buf = readingsRef.current;
    buf.push({ midi: r.midi, time: r.timeMs }); // keep the exact pitch for tolerance checks
    // Keep only the last few seconds — plenty for any note window.
    while (buf.length > 0 && r.timeMs - buf[0].time > 4000) buf.shift();
    setHeard((prev) => (prev === m ? prev : m)); // re-render only when the note changes
  }

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

  // Stop the mic once a run ends.
  useEffect(() => {
    if (phase === 'done' || phase === 'idle') {
      micHandleRef.current?.stop();
      micHandleRef.current = null;
    }
  }, [phase]);

  // Safety: stop the mic if the component unmounts mid-run.
  useEffect(() => () => void micHandleRef.current?.stop(), []);

  async function start() {
    setCorrect(0);
    setGraded(0);
    setCombo(0);
    setMaxCombo(0);
    setMicError(null);
    readingsRef.current = [];

    if (liveMic) {
      try {
        micHandleRef.current = await startMic(handleReading); // needs the click gesture
      } catch {
        setMicError('Could not start the mic — check permissions, then try again.');
        return;
      }
    }
    setPhase('countIn');
  }

  // The grading seam: what pitch did the player play for note `index`, whose
  // sound arrived between fromMs and toMs? Sim mode fakes an answer.
  // Live mode (PRD §6 "right pitch"):
  //   1. Take the readings in the window (skipping the attack).
  //   2. If at least MIN_PITCH_COVERAGE of them are within PITCH_TOLERANCE_CENTS
  //      of the target, it's a hit — even if a bit sharp/flat. Return the target.
  //   3. Otherwise return the most common semitone heard, which becomes the ghost.
  function getPlayed(index: number, fromMs: number, toMs: number): number | null {
    if (liveMic) {
      const expected = SONG.notes[index]?.midi;
      if (expected == null) return null;
      const start = fromMs + (toMs - fromMs) * SKIP_ATTACK;
      const window = readingsRef.current.filter((r) => r.time >= start && r.time <= toMs);
      if (window.length < MIN_READINGS) return null; // too little sound -> silent

      const close = window.filter(
        (r) => Math.abs(r.midi - expected) * 100 <= PITCH_TOLERANCE_CENTS,
      ).length;
      if (close / window.length >= MIN_PITCH_COVERAGE) return expected; // close enough

      // A real miss: report the semitone they mostly played.
      const counts = new Map<number, number>();
      for (const r of window) {
        const m = Math.round(r.midi);
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      let best: number | null = null;
      let bestCount = 0;
      for (const [m, c] of counts) {
        if (c > bestCount) {
          best = m;
          bestCount = c;
        }
      }
      // If the mode rounds to the target (e.g. very wobbly but centered), the
      // Staff would count it correct — so it's effectively a pass. Fine.
      return best;
    }
    // Simulated: usually the right note, sometimes a nearby wrong pitch.
    const expected = SONG.notes[index]?.midi ?? null;
    if (expected == null) return null;
    if (Math.random() < FAKE_ACCURACY) return expected;
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
  const busy = phase === 'countIn' || phase === 'playing';

  return (
    <div className="demo-screen">
      <header className="demo-head">
        <h1>Sight-Reading Spire — reading demo</h1>
        <p className="demo-sub">
          {SONG.tempo} BPM · reading in {INSTRUMENT_KEYS[instrumentKey].label}
        </p>
      </header>

      {/* Instrument key: shows the same music transposed to written pitch (PRD §5). */}
      <div className="demo-keys">
        <span className="demo-keys-label">Instrument:</span>
        {(Object.keys(INSTRUMENT_KEYS) as KeyId[]).map((k) => (
          <button
            key={k}
            className={k === instrumentKey ? 'key-btn active' : 'key-btn'}
            disabled={busy}
            onClick={() => setInstrumentKey(k)}
          >
            {k}
          </button>
        ))}
        <label className="mic-toggle">
          <input
            type="checkbox"
            checked={liveMic}
            disabled={busy}
            onChange={(e) => setLiveMic(e.target.checked)}
          />
          🎤 Live mic
        </label>
        {liveMic && busy && (
          <span className="mic-heard">
            hearing: {heard == null ? '—' : midiName(heard)}
          </span>
        )}
      </div>
      {micError && <p className="mic-error">{micError}</p>}

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
          exercise={SONG}
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
        <button onClick={start} disabled={busy}>
          {phase === 'idle' ? 'Play ▶' : 'Play again ▶'}
        </button>
      </div>
    </div>
  );
}
