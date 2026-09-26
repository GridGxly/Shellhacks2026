'use client';
// Mic + pitch detection (PRD §6). Ported from the team's pitch-detection
// branch (PitchEngine gates: level, clarity, range) to TypeScript.

import { PitchDetector } from 'pitchy';
import { INPUT_LATENCY_MS, MIN_PITCH_COVERAGE, ONSET_RISE_DB, PITCH_TOLERANCE_CENTS } from './config';
import type { Exercise } from './music';

export interface Reading {
  t: number; // performance.now()
  midi: number | null; // concert, fractional; null when rejected
  rmsDb: number;
}

const FFT = 2048;
const CLARITY = 0.85;
const MIN_RMS_DB = -48;

class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private detector = PitchDetector.forFloat32Array(FFT);
  private buf = new Float32Array(FFT);
  private raf: number | null = null;
  private recording: Reading[] | null = null;
  listeners = new Set<(r: Reading) => void>();
  status: 'off' | 'on' | 'denied' | 'unsupported' = 'off';
  deviceLabel = '';

  async start(): Promise<boolean> {
    if (this.status === 'on') return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = 'unsupported';
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      this.status = 'denied';
      return false;
    }
    this.deviceLabel = this.stream.getAudioTracks()[0]?.label ?? 'Microphone';
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.status = 'on';
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.analyser!.getFloatTimeDomainData(this.buf);
      const r = this.analyze();
      this.recording?.push(r);
      this.listeners.forEach((l) => l(r));
    };
    loop();
    return true;
  }

  private analyze(): Reading {
    const [freq, clarity] = this.detector.findPitch(this.buf, this.ctx!.sampleRate);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
    const floor = Math.max(27, (2.5 * this.ctx!.sampleRate) / FFT);
    const ok = rmsDb >= MIN_RMS_DB && freq > 0 && clarity >= CLARITY && freq >= floor && freq <= 4200;
    return { t: performance.now(), midi: ok ? 12 * Math.log2(freq / 440) + 69 : null, rmsDb };
  }

  beginRecording() {
    this.recording = [];
  }
  peek(): Reading[] {
    return this.recording ?? [];
  }
  endRecording(): Reading[] {
    const r = this.recording ?? [];
    this.recording = null;
    return r;
  }
}

export const mic = new Mic();

// ---------------------------------------------------------------- grading

export type NoteStatus = 'hit' | 'wrong' | 'silent';

export interface NoteResult {
  index: number;
  status: NoteStatus;
  playedMidi: number | null; // concert, rounded
  onsetOffsetMs: number | null;
}

function onsets(readings: Reading[]): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    let min = r.rmsDb;
    for (let j = i - 1; j >= 0 && r.t - readings[j].t < 90; j--) min = Math.min(min, readings[j].rmsDb);
    if (r.rmsDb - min >= ONSET_RISE_DB && r.t - last > 90) {
      out.push(r.t);
      last = r.t;
    }
  }
  return out;
}

export function grade(
  ex: Exercise,
  readings: Reading[],
  startPerf: number,
  shift: number,
  timingWindowMs: number,
): NoteResult[] {
  const mspb = 60000 / ex.tempo;
  const ons = onsets(readings);
  return ex.notes.map((n, index) => {
    const expected = n.midi + shift;
    const t0 = startPerf + n.startBeat * mspb + INPUT_LATENCY_MS;
    const t1 = startPerf + (n.startBeat + n.durBeats) * mspb + INPUT_LATENCY_MS - 30;
    const body = readings.filter((r) => r.t >= t0 && r.t <= t1 && r.midi !== null);
    if (body.length < 2) return { index, status: 'silent', playedMidi: null, onsetOffsetMs: null };

    const near = (m: number) => Math.abs(m - expected) * 100 <= PITCH_TOLERANCE_CENTS;
    const onPitch = body.filter((r) => near(r.midi!)).length / body.length;

    const counts = new Map<number, number>();
    body.forEach((r) => counts.set(Math.round(r.midi!), (counts.get(Math.round(r.midi!)) ?? 0) + 1));
    const played = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const prevSame = index > 0 && ex.notes[index - 1].midi === n.midi;
    let onset: number | null = null;
    if (prevSame) {
      onset = ons.find((t) => Math.abs(t - t0) <= timingWindowMs) ?? null;
    } else {
      const first = readings.find((r) => r.midi !== null && near(r.midi) && Math.abs(r.t - t0) <= timingWindowMs);
      onset = first?.t ?? null;
    }
    const pitchOk = onPitch >= MIN_PITCH_COVERAGE;
    const status: NoteStatus = pitchOk && onset !== null ? 'hit' : 'wrong';
    return { index, status, playedMidi: pitchOk ? expected : played, onsetOffsetMs: onset !== null ? onset - t0 : null };
  });
}

/** Demo grading when no instrument/mic: plausible mistakes, ~78% right. */
export function simulate(ex: Exercise, shift: number, skill = 0.8): NoteResult[] {
  return ex.notes.map((n, index) => {
    const r = Math.random();
    if (r < skill) return { index, status: 'hit', playedMidi: n.midi + shift, onsetOffsetMs: (Math.random() - 0.5) * 80 };
    if (r < skill + 0.04) return { index, status: 'silent', playedMidi: null, onsetOffsetMs: null };
    const off = Math.random() < 0.5 ? -2 : -1;
    return { index, status: 'wrong', playedMidi: n.midi + shift + off, onsetOffsetMs: 40 };
  });
}
