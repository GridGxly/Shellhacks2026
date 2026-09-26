'use client';
// Mic + pitch detection (PRD §6). The per-frame work is the team's
// pitch-detection engine (lib/pitch/engine.ts: level / clarity / range gates)
// and stabilizer (lib/pitch/stabilizer.ts: steady note for display). Grading
// maps each written note to what was played using the sight-reading demo's
// logic (skip the attack, coverage within tolerance, else the modal semitone).

import { IGNORE_OCTAVE, INPUT_LATENCY_MS, MIN_PITCH_COVERAGE, MIN_READINGS, ONSET_RISE_DB, PITCH_TOLERANCE_CENTS, SKIP_ATTACK } from './config';
import type { Exercise } from './music';
import { DEFAULT_FFT_SIZE, PitchEngine, type RejectReason } from './pitch/engine';

// One analysis window at 44.1 kHz (2048 / 44100 s).
const ANALYSIS_LAG_MS = (DEFAULT_FFT_SIZE / 44100) * 1000;

// How long after a note starts the detector first reports it. Coming from
// another pitch (legato), pitchy flips only once the new note fills most of the
// buffer (~a whole window). From silence nothing competes, so it locks on after
// ~30% of the buffer. Measured with synthesized tones; see Pitch Lab to check.
function detectLag(readings: Reading[], k: number): number {
  return k > 0 && readings[k - 1].midi !== null ? ANALYSIS_LAG_MS : ANALYSIS_LAG_MS * 0.3;
}
import { PitchStabilizer } from './pitch/stabilizer';

export interface Reading {
  t: number; // performance.now()
  midi: number | null; // concert, fractional, raw frame; null when rejected
  rmsDb: number;
  tailDb: number; // newest ~12 ms only; sharp envelope for onsets
  clarity: number;
  rejectedBy: RejectReason | null;
  stableMidi: number | null; // stabilizer output for display; null while unsettled
}

/** Listener set that wakes the analysis loop when a screen starts listening. */
class Watchers extends Set<(r: Reading) => void> {
  constructor(private readonly wake: () => void) { super(); }
  add(listener: (r: Reading) => void) { super.add(listener); this.wake(); return this; }
}

class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private engine = new PitchEngine({ bufferSize: DEFAULT_FFT_SIZE });
  private stabilizer = new PitchStabilizer();
  private buf = new Float32Array(DEFAULT_FFT_SIZE);
  private raf: number | null = null;
  private recording: Reading[] | null = null;
  listeners = new Watchers(() => this.wake());
  status: 'off' | 'on' | 'denied' | 'unsupported' = 'off';
  deviceLabel = '';

  // Reuse the same permission and input for ephemeral tavern takes.
  get mediaStream(): MediaStream | null { return this.stream; }

  /** Called from a tap/key gesture so an interrupted mobile context can resume. */
  resume() {
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume().catch(() => {});
  }

  async start(): Promise<boolean> {
    if (this.status === 'on') return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = 'unsupported';
      return false;
    }
    try {
      // Browser "enhancements" reshape a sustained instrument tone enough to
      // disturb pitch tracking, so all three are off.
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
    this.analyser.fftSize = DEFAULT_FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.stabilizer.reset();
    this.status = 'on';
    this.wake();
    return true;
  }

  // The stream stays open between fights (no new permission prompt), but pitch
  // analysis only runs while a screen listens or a take is being recorded, so
  // menus and the map don't burn a phone's CPU on a detector nobody reads.
  private loop = () => {
    if (!this.analyser || (!this.listeners.size && !this.recording)) {
      this.raf = null;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    this.analyser.getFloatTimeDomainData(this.buf);
    const r = this.analyze();
    this.recording?.push(r);
    this.listeners.forEach((l) => l(r));
  };

  private wake() {
    if (this.raf !== null || !this.analyser) return;
    this.stabilizer.reset();
    this.loop();
  }

  stop() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.status = 'off';
  }

  private analyze(): Reading {
    const frame = this.engine.analyze(this.buf, this.ctx!.sampleRate);
    const settled = this.stabilizer.push(frame);
    return {
      t: performance.now(),
      midi: frame.midi,
      rmsDb: frame.rmsDb,
      tailDb: frame.tailDb,
      clarity: frame.clarity,
      rejectedBy: frame.rejectedBy,
      stableMidi: settled?.midi ?? null,
    };
  }

  beginRecording() {
    this.recording = [];
    this.wake();
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

// Attack times from the sharp tail envelope: a rise of ONSET_RISE_DB over the
// quietest point in the last ONSET_LOOKBACK_MS (the tongue gap between notes).
const ONSET_LOOKBACK_MS = 60;
// The attack lands somewhere between the previous frame and this one (~17 ms
// apart at 60 fps); back-date by half that. Measured with synthesized tones.
const ONSET_LAG_MS = 8;
function onsets(readings: Reading[]): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    let min = r.tailDb;
    for (let j = i - 1; j >= 0 && r.t - readings[j].t <= ONSET_LOOKBACK_MS; j--) min = Math.min(min, readings[j].tailDb);
    if (r.tailDb - min >= ONSET_RISE_DB && r.t - last > 90) {
      out.push(r.t - ONSET_LAG_MS);
      last = r.t;
    }
  }
  return out;
}

/**
 * What pitch did the player play for a note whose sound should arrive between
 * fromT and toT? Returns `expected` when close enough, the semitone they mostly
 * played on a real miss, or null for silence.
 */
/** With IGNORE_OCTAVE, move a detected pitch into the target's octave (within ±6 semitones). */
function fold(m: number, expected: number): number {
  if (!IGNORE_OCTAVE) return m;
  const d = m - expected;
  return expected + d - 12 * Math.round(d / 12);
}

function playedPitch(readings: Reading[], expected: number, fromT: number, toT: number): number | null {
  // Skip the attack: the previous note is still ringing / this one is settling.
  const start = fromT + (toT - fromT) * SKIP_ATTACK;
  const win = readings.filter((r) => r.t >= start && r.t <= toT && r.midi !== null);
  if (win.length < MIN_READINGS) return null;

  // Close enough (a bit sharp/flat is fine) on most frames -> the target.
  const close = win.filter((r) => Math.abs(fold(r.midi!, expected) - expected) * 100 <= PITCH_TOLERANCE_CENTS).length;
  if (close / win.length >= MIN_PITCH_COVERAGE) return expected;

  // A real miss: the semitone they mostly played. If that rounds to the target
  // (very wobbly but centred), it's effectively a pass.
  const counts = new Map<number, number>();
  for (const r of win) {
    const m = Math.round(fold(r.midi!, expected));
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
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
    // Legacy Staff.tsx window: this note's start to the next note's start,
    // both shifted by mic latency.
    const t0 = startPerf + n.startBeat * mspb + INPUT_LATENCY_MS;
    const t1 = startPerf + (n.startBeat + n.durBeats) * mspb + INPUT_LATENCY_MS;

    // Legacy rule: the pitch played over the window decides the note, full stop.
    const played = playedPitch(readings, expected, t0, t1);
    if (played === null) return { index, status: 'silent', playedMidi: null, onsetOffsetMs: null };
    const status: NoteStatus = played === expected ? 'hit' : 'wrong';

    // Onset is measured for feedback (taunts: "you were late") but never fails
    // a note. A repeated pitch has no pitch change to key on, so use a level
    // onset; otherwise the first on-pitch frame near the note's start.
    const near = (m: number) => Math.abs(fold(m, expected) - expected) * 100 <= PITCH_TOLERANCE_CENTS;
    const prevSame = index > 0 && ex.notes[index - 1].midi === n.midi;
    let onset: number | null = null;
    if (prevSame) {
      // Nearest attack, not the first: on fast repeated notes the previous
      // note's (late) attack can also fall inside the window.
      for (const t of ons) if (Math.abs(t - t0) <= timingWindowMs && (onset === null || Math.abs(t - t0) < Math.abs(onset - t0))) onset = t;
    } else {
      // A frame is stamped at the END of its buffer, so back-date the first
      // frame that reads this pitch by how much of the buffer it needed.
      for (let k = 0; k < readings.length; k++) {
        const r = readings[k];
        if (r.midi === null || !near(r.midi)) continue;
        const t = r.t - detectLag(readings, k);
        if (Math.abs(t - t0) <= timingWindowMs) {
          onset = t;
          break;
        }
      }
    }
    return { index, status, playedMidi: played, onsetOffsetMs: onset !== null ? onset - t0 : null };
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
