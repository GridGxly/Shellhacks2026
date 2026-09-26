// Median-filters the recent pitch history before naming the note, ported from
// legacy/vite-src/stabilizer.js.
//
// Frame-by-frame readings are accurate, but a note played out of tune sits near
// a semitone boundary where tiny wobbles flip the reported name back and forth.
// Taking the median over a short window, then naming that, keeps the display
// steady without the lag a long average would add. This is for DISPLAY only;
// grading reads the raw frames so a sharp-but-close note is measured honestly.

import type { FrameAnalysis } from './engine';

export interface Settled {
  midi: number; // median of the window, fractional
  note: number; // agreed semitone (rounded midi)
  agreement: number; // share of the window on that semitone, 0..1
}

export interface StabilizerOptions {
  windowSize?: number;
  minAgreement?: number;
  maxDropoutFrames?: number;
}

export class PitchStabilizer {
  private windowSize: number;
  private minAgreement: number;
  // A single unclear frame mid-note (a bow change, a finger shift) should not
  // discard the history and force the display to re-settle from scratch.
  private maxDropoutFrames: number;
  private midis: number[] = [];
  private dropouts = 0;

  constructor({ windowSize = 5, minAgreement = 3, maxDropoutFrames = 2 }: StabilizerOptions = {}) {
    this.windowSize = windowSize;
    this.minAgreement = minAgreement;
    this.maxDropoutFrames = maxDropoutFrames;
  }

  reset() {
    this.midis = [];
    this.dropouts = 0;
  }

  // Returns the settled pitch, or null while there is not yet enough agreement.
  push(frame: FrameAnalysis): Settled | null {
    if (!frame.accepted || frame.midi === null) {
      this.dropouts++;
      // A sustained gap means the note really ended; start fresh rather than
      // blending its tail into whatever comes next.
      if (this.dropouts > this.maxDropoutFrames) {
        this.reset();
        return null;
      }
      return this.current();
    }

    this.dropouts = 0;
    this.midis.push(frame.midi);
    if (this.midis.length > this.windowSize) this.midis.shift();
    return this.current();
  }

  current(): Settled | null {
    if (!this.midis.length) return null;

    const sorted = [...this.midis].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Report only once a majority of the window agrees, so the attack
    // transient is not displayed as a note of its own.
    const counts = new Map<number, number>();
    for (const m of this.midis) {
      const n = Math.round(m);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    let best = 0;
    let bestCount = 0;
    for (const [n, c] of counts) {
      if (c > bestCount) {
        best = n;
        bestCount = c;
      }
    }

    if (bestCount < Math.min(this.minAgreement, this.windowSize)) return null;
    return { midi: median, note: best, agreement: bestCount / this.midis.length };
  }
}
