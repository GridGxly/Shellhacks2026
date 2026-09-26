'use client';
import { ac, clickAt, duetTone, effectsOutput, muteMusic, settings, stopVoices } from './audio';
import { TIMING_WINDOW_MS } from './config';
import { grade, mic, simulate, type NoteResult } from './mic';
import type { Exercise } from './music';

let audioOwner = 0;
const aborted = () => new DOMException('Practice stopped', 'AbortError');
export const phraseDuration = (ex: Exercise) => ex.bars * ex.beatsPerBar * 60000 / ex.tempo;

/** Audio startup can be interrupted before the browser resolves resume(). */
function resumeContext(ctx: AudioContext, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve();
    };
    const cancel = () => finish(aborted());
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) return cancel();
    try { void ctx.resume().then(() => finish(), finish); } catch (error) { finish(error); }
  });
}

/** Preview sources belong to one gesture; leaving or starting a take stops all of them. */
export async function previewTraining(ex: Exercise, shift: number, signal: AbortSignal) {
  if (signal.aborted) throw aborted();
  const owner = ++audioOwner;
  const sources: OscillatorNode[] = [];
  stopVoices(); muteMusic(true);
  try {
    const ctx = ac(); await resumeContext(ctx, signal);
    if (signal.aborted) throw aborted();
    const start = ctx.currentTime + 0.16;
    sources.push(...ex.notes.map(n => duetTone(n.midi + shift, start + n.startBeat * 60 / ex.tempo, n.durBeats * 60 / ex.tempo * .85, effectsOutput())));
    await new Promise<void>((resolve, reject) => {
      const stop = () => { clearTimeout(timer); reject(aborted()); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, phraseDuration(ex) + 300);
      signal.addEventListener('abort', stop, { once: true });
    });
  } finally {
    sources.forEach(source => { try { source.stop(); } catch {} source.disconnect(); });
    if (owner === audioOwner) muteMusic(false);
  }
}

export interface TrainingFrame {
  phase: 'countin' | 'performing';
  beat: number;
  count: number;
  results: (NoteResult | undefined)[];
  activity: number;
  pitch: number | null;
}

/** Keep the teammate's grader unchanged. Both real and demo takes follow the full phrase clock. */
export async function performTraining(ex: Exercise, shift: number, demo: boolean, downbeat: number, signal: AbortSignal, frame: (value: TrainingFrame) => void): Promise<NoteResult[]> {
  if (signal.aborted) throw aborted();
  const owner = ++audioOwner;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const clicks: OscillatorNode[] = [];
  let raf = 0;
  let cancel = () => {};
  stopVoices(); muteMusic(true);
  try {
    const ctx = ac(); await resumeContext(ctx, signal);
    if (signal.aborted) throw aborted();
    const beatMs = 60000 / ex.tempo;
    const startPerf = performance.now() + downbeat - Date.now();
    const count = settings.countIn === 2 ? 2 : 4;
    for (let b = -count; b < 0; b++) {
      const target = downbeat + b * beatMs;
      if (target < Date.now() - 50) continue;
      timers.push(setTimeout(() => {
        if (signal.aborted) return;
        const click = clickAt(ctx.currentTime + Math.max(0, target - Date.now()) / 1000, b === -count);
        if (click) clicks.push(click);
      }, Math.max(0, target - Date.now() - 80)));
    }
    const simulated = demo ? simulate(ex, shift) : null;
    let begun = false;
    return await new Promise<NoteResult[]>((resolve, reject) => {
      cancel = () => reject(aborted());
      signal.addEventListener('abort', cancel, { once: true });
      const tick = () => {
        if (signal.aborted) return cancel();
        const elapsed = performance.now() - startPerf;
        if (elapsed >= 0 && !begun) { begun = true; mic.beginRecording(); }
        if (elapsed >= phraseDuration(ex) + 250) {
          const final = simulated ?? grade(ex, mic.endRecording(), startPerf, shift, TIMING_WINDOW_MS);
          resolve(final); return;
        }
        const live = begun ? simulated ?? grade(ex, mic.peek(), startPerf, shift, TIMING_WINDOW_MS) : [];
        const reading = mic.peek().at(-1);
        frame({
          phase: elapsed < 0 ? 'countin' : 'performing', beat: elapsed / beatMs,
          count: elapsed < 0 ? Math.max(1, count - Math.ceil(-elapsed / beatMs) + 1) : 0,
          results: live.map((note, i) => elapsed >= (ex.notes[i].startBeat + ex.notes[i].durBeats) * beatMs + 110 ? note : undefined),
          activity: !demo && reading ? Math.max(0, Math.min(1, (reading.rmsDb + 60) / 50)) : 0,
          pitch: !demo ? reading?.stableMidi ?? null : null,
        });
        raf = requestAnimationFrame(tick);
      };
      tick();
    });
  } finally {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout);
    clicks.forEach(click => { try { click.stop(); } catch {} click.disconnect(); });
    signal.removeEventListener('abort', cancel);
    if (owner === audioOwner) { mic.endRecording(); mic.stop(); muteMusic(false); }
  }
}

/** Voices use decoded buffers so cancellation stops speech immediately, without leaked URLs. */
export async function speakTraining(body: unknown, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted || !settings.voice) return false;
  const response = await fetch('/api/training/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
  if (!response.ok || !response.headers.get('content-type')?.includes('audio')) return false;
  const bytes = await response.arrayBuffer();
  if (signal.aborted) return false;
  const ctx = ac();
  const buffer = await ctx.decodeAudioData(bytes);
  if (signal.aborted) return false;
  const volume = ctx.createGain(); volume.gain.value = settings.voice; volume.connect(ctx.destination);
  const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(volume);
  await new Promise<void>((resolve) => {
    const stop = () => { try { source.stop(); } catch {} resolve(); };
    source.onended = () => { signal.removeEventListener('abort', stop); source.disconnect(); volume.disconnect(); resolve(); };
    signal.addEventListener('abort', stop, { once: true });
    source.start();
  });
  return !signal.aborted;
}
