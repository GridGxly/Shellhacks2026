'use client';
// Count-in -> record -> grade, the same loop and timing as Combat and Pitch Lab,
// packaged for any screen that wants the player to perform an Exercise.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ac, clickAt, muteMusic, settings } from '@/lib/audio';
import { COUNT_IN_BEATS, RECORD_TAIL_MS, TIMING_WINDOW_MS } from '@/lib/config';
import { grade, mic, type NoteResult } from '@/lib/mic';
import type { Exercise } from '@/lib/music';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const clock = () => performance.now();

export type PerfStage = 'idle' | 'countin' | 'recording' | 'done';

export function usePerformance() {
  const [stage, setStage] = useState<PerfStage>('idle');
  const [count, setCount] = useState(0);
  const [beat, setBeat] = useState<number | null>(null);
  const [results, setResults] = useState<(NoteResult | undefined)[]>([]);
  const [micStatus, setMicStatus] = useState(mic.status);
  const alive = useRef(true);

  // Mic on and music muted (it would leak into the mic) while the screen is up.
  useEffect(() => {
    alive.current = true;
    muteMusic(true);
    mic.start().then(() => alive.current && setMicStatus(mic.status));
    return () => {
      alive.current = false;
      muteMusic(false);
    };
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setBeat(null);
    setResults([]);
  }, []);

  /** Perform `ex`; resolves with the final grade, or null if it couldn't run. */
  const play = useCallback(async (ex: Exercise, shift: number): Promise<NoteResult[] | null> => {
    if (mic.status !== 'on' || !ex.notes.length) return null;
    const approach = settings.approach === 'on';
    setResults([]);
    setStage('countin');
    const mspb = 60000 / ex.tempo;
    const t0 = ac().currentTime + 0.12;
    for (let b = 0; b < COUNT_IN_BEATS; b++) clickAt(t0 + (b * mspb) / 1000, b === 0);
    const startPerf = clock() + 120 + COUNT_IN_BEATS * mspb;
    for (let b = 0; b < COUNT_IN_BEATS; b++) window.setTimeout(() => alive.current && setCount(b + 1), 120 + b * mspb);
    // Negative beats through the count-in so follow-along circles start closing early.
    let counting = approach;
    const pre = () => {
      if (!counting || !alive.current) return;
      setBeat((clock() - startPerf) / mspb);
      requestAnimationFrame(pre);
    };
    requestAnimationFrame(pre);
    await wait(120 + COUNT_IN_BEATS * mspb - 30);
    counting = false;
    if (!alive.current) return null;

    mic.beginRecording();
    setStage('recording');
    const last = ex.notes[ex.notes.length - 1];
    const totalBeats = last.startBeat + last.durBeats;
    await new Promise<void>((done) => {
      const tick = () => {
        if (!alive.current) return done();
        const now = clock();
        const g = grade(ex, mic.peek(), startPerf, shift, TIMING_WINDOW_MS);
        setBeat(Math.max(0, (now - startPerf) / mspb));
        setResults(ex.notes.map((n, i) => (now >= startPerf + (n.startBeat + n.durBeats) * mspb + 110 ? g[i] : undefined)));
        if (now > startPerf + totalBeats * mspb + RECORD_TAIL_MS) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const final = grade(ex, mic.endRecording(), startPerf, shift, TIMING_WINDOW_MS);
    if (!alive.current) return null;
    setResults(final);
    setBeat(null);
    setStage('done');
    return final;
  }, []);

  return { stage, count, beat, results, micStatus, play, reset, approach: settings.approach === 'on' };
}
