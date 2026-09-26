import { PitchDetector } from 'pitchy';
import { Note } from 'tonal';

export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_CLARITY_THRESHOLD = 0.85;

/**
 * Room noise can correlate by chance at very long lags, yielding a
 * sub-audible "note" with high clarity. Bounding the result to the range a
 * real instrument produces rejects those outright. C0 is below any orchestral
 * instrument's fundamental; C8 is the top of a piano.
 */
export const DEFAULT_MIN_FREQ = 27;   // A0, the lowest note on a piano
export const DEFAULT_MAX_FREQ = 4200; // ~C8

/**
 * A pitch is only trustworthy when several periods fit inside the analysis
 * window; at one period per window the detector will happily "find" a pitch in
 * noise. The effective floor is therefore whichever is higher, this derived
 * limit or `minFreq`.
 */
export const MIN_PERIODS_PER_WINDOW = 2.5;

/**
 * Clarity alone does not distinguish a quiet room from a quiet note, so a
 * level gate is applied as well. -48 dBFS sits above typical room tone while
 * staying below genuinely soft playing.
 */
export const DEFAULT_MIN_RMS_DB = -48;

/**
 * Converts a frequency to note information, including how far off the
 * frequency sits from the nearest equal-tempered pitch. The cents offset is
 * what tells us whether a reading is genuinely on-pitch or drifting toward a
 * neighbour, which is the signal we need when judging flicker.
 */
export function describeFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;

  const noteName = Note.fromFreq(frequency);
  const note = Note.get(noteName);
  if (note.empty || note.freq == null) return null;

  const cents = 1200 * Math.log2(frequency / note.freq);

  return {
    noteName,
    midi: note.midi,
    referenceFreq: note.freq,
    cents,
  };
}

/**
 * Wraps a pitchy PitchDetector so both the microphone loop and the offline
 * file analysis run through identical logic — the point of the validation step
 * is that a recorded file reproduces what the mic did.
 */
export class PitchEngine {
  constructor({
    bufferSize = DEFAULT_FFT_SIZE,
    clarityThreshold = DEFAULT_CLARITY_THRESHOLD,
    minFreq = DEFAULT_MIN_FREQ,
    maxFreq = DEFAULT_MAX_FREQ,
    minRmsDb = DEFAULT_MIN_RMS_DB,
  } = {}) {
    this.bufferSize = bufferSize;
    this.clarityThreshold = clarityThreshold;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;
    this.minRmsDb = minRmsDb;
    this.detector = PitchDetector.forFloat32Array(bufferSize);
  }

  /**
   * Lowest frequency this buffer size can resolve with enough periods to be
   * believed, never below the configured musical minimum.
   */
  floorFor(sampleRate) {
    return Math.max(this.minFreq, (MIN_PERIODS_PER_WINDOW * sampleRate) / this.bufferSize);
  }

  /**
   * @param {Float32Array} buffer time-domain samples, length === bufferSize
   * @param {number} sampleRate
   * @returns {{frequency: number|null, clarity: number, noteName: string|null,
   *            midi: number|null, cents: number|null, rms: number,
   *            rmsDb: number, accepted: boolean, rejectedBy: string|null}}
   */
  analyze(buffer, sampleRate) {
    const [frequency, clarity] = this.detector.findPitch(buffer, sampleRate);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i += 1) sumSquares += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSquares / buffer.length);

    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    // Report which gate rejected a frame — when tuning thresholds against a
    // recording, "too quiet" and "not a clear pitch" call for opposite changes.
    let rejectedBy = null;
    if (rmsDb < this.minRmsDb) rejectedBy = 'level';
    else if (!(frequency > 0)) rejectedBy = 'no-pitch';
    else if (clarity < this.clarityThreshold) rejectedBy = 'clarity';
    else if (frequency < this.floorFor(sampleRate) || frequency > this.maxFreq) rejectedBy = 'range';

    const accepted = rejectedBy === null;
    const described = accepted ? describeFrequency(frequency) : null;

    return {
      frequency: accepted ? frequency : null,
      clarity,
      rms,
      rmsDb,
      accepted,
      rejectedBy,
      noteName: described?.noteName ?? null,
      midi: described?.midi ?? null,
      cents: described?.cents ?? null,
    };
  }
}
