// Frame-level pitch detection, ported from the pitch-detection branch
// (legacy/vite-src/pitch-engine.js). One analyze() call per audio buffer:
// McLeod pitch via pitchy, then level / clarity / range gates.

import { PitchDetector } from 'pitchy';

export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_CLARITY_THRESHOLD = 0.85;

// Room noise can correlate by chance at very long lags, yielding a sub-audible
// "note" with high clarity. Bounding to the range real instruments produce
// rejects those outright.
export const DEFAULT_MIN_FREQ = 27; // A0, the lowest note on a piano
export const DEFAULT_MAX_FREQ = 4200; // ~C8

// A pitch is only trustworthy when several periods fit inside the analysis
// window; at one period per window the detector will "find" a pitch in noise.
export const MIN_PERIODS_PER_WINDOW = 2.5;

// Clarity alone does not distinguish a quiet room from a quiet note, so a
// level gate is applied too. -48 dBFS sits above room tone, below soft playing.
export const DEFAULT_MIN_RMS_DB = -48;

// Floor for the level readout so silence is a finite number the UI can scale.
const SILENCE_DB = -120;

// Samples at the newest end of the buffer used for the attack envelope (~12 ms
// at 44.1 kHz). The full-window level smears a short tongue gap together with
// the previous note's tail; the tail alone sees the dip and the attack sharply.
export const TAIL_SAMPLES = 512;

export type RejectReason = 'level' | 'no-pitch' | 'clarity' | 'range';

export interface FrameAnalysis {
  frequency: number | null; // null when a gate rejected the frame
  midi: number | null; // concert, fractional (69.3 = A4, 30 cents sharp)
  clarity: number;
  rmsDb: number;
  tailDb: number; // level of the newest TAIL_SAMPLES only, for onset timing
  accepted: boolean;
  // Which gate rejected the frame. When tuning against a recording, "too quiet"
  // and "not a clear pitch" call for opposite changes.
  rejectedBy: RejectReason | null;
}

function toDb(rms: number): number {
  return rms > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(rms)) : SILENCE_DB;
}

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

export interface EngineOptions {
  bufferSize?: number;
  clarityThreshold?: number;
  minFreq?: number;
  maxFreq?: number;
  minRmsDb?: number;
}

export class PitchEngine {
  readonly bufferSize: number;
  private clarityThreshold: number;
  private minFreq: number;
  private maxFreq: number;
  private minRmsDb: number;
  private detector: PitchDetector<Float32Array>;

  constructor({
    bufferSize = DEFAULT_FFT_SIZE,
    clarityThreshold = DEFAULT_CLARITY_THRESHOLD,
    minFreq = DEFAULT_MIN_FREQ,
    maxFreq = DEFAULT_MAX_FREQ,
    minRmsDb = DEFAULT_MIN_RMS_DB,
  }: EngineOptions = {}) {
    this.bufferSize = bufferSize;
    this.clarityThreshold = clarityThreshold;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;
    this.minRmsDb = minRmsDb;
    this.detector = PitchDetector.forFloat32Array(bufferSize);
  }

  // Lowest frequency this buffer size can resolve with enough periods to be
  // believed, never below the configured musical minimum.
  floorFor(sampleRate: number): number {
    return Math.max(this.minFreq, (MIN_PERIODS_PER_WINDOW * sampleRate) / this.bufferSize);
  }

  analyze(buffer: Float32Array, sampleRate: number): FrameAnalysis {
    const [frequency, clarity] = this.detector.findPitch(buffer, sampleRate);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) sumSquares += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSquares / buffer.length);
    const rmsDb = toDb(rms);

    let tailSquares = 0;
    const tailStart = Math.max(0, buffer.length - TAIL_SAMPLES);
    for (let i = tailStart; i < buffer.length; i++) tailSquares += buffer[i] * buffer[i];
    const tailDb = toDb(Math.sqrt(tailSquares / (buffer.length - tailStart)));

    let rejectedBy: RejectReason | null = null;
    if (rmsDb < this.minRmsDb) rejectedBy = 'level';
    else if (!(frequency > 0)) rejectedBy = 'no-pitch';
    else if (clarity < this.clarityThreshold) rejectedBy = 'clarity';
    else if (frequency < this.floorFor(sampleRate) || frequency > this.maxFreq) rejectedBy = 'range';

    const accepted = rejectedBy === null;
    return {
      frequency: accepted ? frequency : null,
      midi: accepted ? freqToMidi(frequency) : null,
      clarity,
      rmsDb,
      tailDb,
      accepted,
      rejectedBy,
    };
  }
}
