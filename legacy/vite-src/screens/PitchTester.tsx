/**
 * PitchTester.tsx — a standalone mic/pitch monitor (no sheet music).
 *
 * Purpose: prove the pitch-detection backend works on its own. It talks directly
 * to MicPitchTracker (mic.js -> pitch-engine.js + stabilizer.js) and shows every
 * field it produces: the stabilized note, the instant note + frequency + cents,
 * clarity, level, and — when a frame is rejected — WHY (level / clarity / range /
 * no-pitch). That last part is the key debugging tool.
 */

import { useEffect, useRef, useState } from 'react';
import * as abcjs from 'abcjs';
// mic.js is plain JS (allowJs); import the class directly.
import { MicPitchTracker } from '../mic.js';
import { freqToMidi } from '../audio/pitch';
import { midiToAbcPitch } from '../notation/toAbc';

// The shape mic.js hands to onReading (see its JSDoc + pitch-engine.analyze()).
interface MicReading {
  accepted: boolean;
  frequency: number | null;
  clarity: number;
  rms: number;
  rmsDb: number;
  noteName: string | null;
  midi: number | null;
  cents: number | null;
  rejectedBy: string | null;
  timestamp: number;
  stableNote: string | null;
  stableFreq: number | null;
}

export function PitchTester() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<MicReading | null>(null);
  const [noteMidi, setNoteMidi] = useState<number | null>(null); // detected pitch, for the staff
  const trackerRef = useRef<{ start: () => Promise<unknown>; stop: () => Promise<void> } | null>(null);
  const staffRef = useRef<HTMLDivElement>(null);

  // Always stop the mic if we leave the page.
  useEffect(() => () => void trackerRef.current?.stop(), []);

  // Draw the detected note on a staff by letting ABCJS place it — no pixel math.
  // A single-note ABC string is rendered fresh whenever the detected pitch changes.
  useEffect(() => {
    if (!staffRef.current) return;
    const body = noteMidi == null ? 'x8' : `${midiToAbcPitch(noteMidi)}8`; // x = invisible rest
    abcjs.renderAbc(staffRef.current, `X:1\nL:1/8\nK:C\n${body}`, { staffwidth: 260, scale: 1.6 });
  }, [noteMidi]);

  async function startMic() {
    setError(null);
    const tracker = new MicPitchTracker({
      // mic.js's JSDoc under-declares the payload; at runtime it includes the full
      // analyze() result (rmsDb, noteName, midi, cents, rejectedBy), so cast.
      onReading: (r: unknown) => {
        const reading = r as MicReading;
        setReading(reading);
        // Prefer the stabilized pitch; fall back to the instant one.
        let m: number | null = null;
        if (reading.accepted) {
          if (reading.stableFreq != null) m = Math.round(freqToMidi(reading.stableFreq));
          else if (reading.midi != null) m = Math.round(reading.midi);
        }
        setNoteMidi((prev) => (prev === m ? prev : m)); // re-render staff only on change
      },
    });
    try {
      await tracker.start();
      trackerRef.current = tracker;
      setRunning(true);
    } catch {
      setError('Could not start the mic — check the browser permission and try again.');
    }
  }

  async function stopMic() {
    await trackerRef.current?.stop();
    trackerRef.current = null;
    setRunning(false);
    setReading(null);
    setNoteMidi(null);
  }

  const accepted = reading?.accepted ?? false;
  const cents = reading?.cents ?? 0;
  const inTune = accepted && Math.abs(cents) <= 10;
  // Clamp the needle to the [-50, +50] cent window.
  const needlePct = 50 + Math.max(-50, Math.min(50, cents));

  return (
    <div className="tuner-screen">
      <h1>Pitch detection tester</h1>
      <p className="tuner-sub">Play a steady note. This reads the mic directly — no sheet music.</p>

      {/* The detected note, drawn on a real staff by abcjs (the mapping test). */}
      <div className="tuner-staff" ref={staffRef} />

      {/* Big current note (the stabilized one is the trustworthy read). */}
      <div className={`tuner-note ${accepted ? (inTune ? 'in' : 'near') : 'off'}`}>
        {running ? reading?.stableNote ?? reading?.noteName ?? '—' : '—'}
      </div>

      {/* Cents meter: needle left = flat, right = sharp, center = in tune. */}
      <div className="cents-bar">
        <div className="cents-center" />
        <div
          className={`cents-needle ${inTune ? 'in' : 'near'}`}
          style={{ left: `${needlePct}%`, opacity: accepted ? 1 : 0.2 }}
        />
        <span className="cents-label left">♭ flat</span>
        <span className="cents-label right">sharp ♯</span>
      </div>
      <div className="tuner-cents">{accepted ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents` : ' '}</div>

      {/* Raw fields, so you can see exactly what the engine reports. */}
      <div className="tuner-grid">
        <Field label="frequency" value={reading?.frequency != null ? `${reading.frequency.toFixed(1)} Hz` : '—'} />
        <Field label="instant note" value={reading?.noteName ?? '—'} />
        <Field label="clarity" value={reading ? reading.clarity.toFixed(2) : '—'} />
        <Field label="level" value={reading && isFinite(reading.rmsDb) ? `${reading.rmsDb.toFixed(0)} dB` : '—'} />
        <Field
          label="status"
          value={!running ? 'stopped' : accepted ? 'accepted ✓' : `rejected: ${reading?.rejectedBy ?? '—'}`}
        />
      </div>

      {error && <p className="mic-error">{error}</p>}

      <div className="demo-controls">
        {running ? (
          <button onClick={stopMic}>Stop</button>
        ) : (
          <button onClick={startMic}>Start mic 🎤</button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="tuner-field">
      <span className="tuner-field-val">{value}</span>
      <span className="tuner-field-label">{label}</span>
    </div>
  );
}
