/**
 * Median-filters the recent frequency history before naming the note.
 *
 * Frame-by-frame readings are accurate but a note played out of tune sits near
 * a semitone boundary, where tiny wobbles flip the reported name back and
 * forth. Taking the median frequency over a short window, then naming that,
 * keeps the display steady without adding the lag a long average would.
 */
export class PitchStabilizer {
  constructor({ windowSize = 5, minAgreement = 3, maxDropoutFrames = 2 } = {}) {
    this.windowSize = windowSize;
    this.minAgreement = minAgreement;
    // A single unclear frame mid-note (a bow change, a finger shift) should not
    // discard the history and force the display to re-settle from scratch.
    this.maxDropoutFrames = maxDropoutFrames;
    this.frequencies = [];
    this.notes = [];
    this.dropouts = 0;
  }

  reset() {
    this.frequencies = [];
    this.notes = [];
    this.dropouts = 0;
  }

  /**
   * @param {{accepted: boolean, frequency: number|null, noteName: string|null}} reading
   * @returns {{frequency: number, noteName: string, agreement: number}|null}
   *   the settled pitch, or null while there is not yet enough agreement
   */
  push(reading) {
    if (!reading.accepted) {
      this.dropouts += 1;
      // A sustained gap means the note really ended; start fresh rather than
      // blending its tail into whatever comes next.
      if (this.dropouts > this.maxDropoutFrames) {
        this.reset();
        return null;
      }
      return this.current();
    }

    this.dropouts = 0;
    this.frequencies.push(reading.frequency);
    this.notes.push(reading.noteName);
    if (this.frequencies.length > this.windowSize) {
      this.frequencies.shift();
      this.notes.shift();
    }

    return this.current();
  }

  /** The settled pitch for the current window, or null if not yet settled. */
  current() {
    if (!this.frequencies.length) return null;

    const sorted = [...this.frequencies].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Report only once a majority of the window agrees, so the attack
    // transient does not get displayed as a note of its own.
    const counts = new Map();
    for (const n of this.notes) counts.set(n, (counts.get(n) ?? 0) + 1);
    let best = null;
    let bestCount = 0;
    for (const [note, count] of counts) {
      if (count > bestCount) {
        best = note;
        bestCount = count;
      }
    }

    const required = Math.min(this.minAgreement, this.windowSize);
    if (bestCount < required) return null;

    return { frequency: median, noteName: best, agreement: bestCount / this.notes.length };
  }
}
