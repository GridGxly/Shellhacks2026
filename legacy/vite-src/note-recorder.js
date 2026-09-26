/**
 * Records a timestamped log of settled notes as they're played, for the
 * tempo-comparison feature to consume later. This does not compare against
 * anything yet — it just captures { time, pitch } per note so that timing
 * data exists once we're ready to build on it.
 */
export class NoteRecorder {
  constructor() {
    this.notes = [];
    this.currentNote = null;
    this.startTime = null;
  }

  reset() {
    this.notes = [];
    this.currentNote = null;
    this.startTime = null;
  }

  /**
   * Feed it the same settled reading the UI already displays each frame:
   * { stableNote, stableFreq, timestamp } from the mic, or
   * { stableNote, stableFreq, timeMs } from file analysis.
   *
   * A new entry is logged only on the transition into a note (silence -> note,
   * or note A -> note B), not on every frame the note is held. Recorded time
   * is elapsed ms since the first frame pushed after a reset, not the raw
   * clock value, so a recording always starts at 0.
   */
  push({ stableNote, stableFreq, timestamp, timeMs }) {
    const rawTime = timestamp ?? timeMs;
    if (this.startTime === null) this.startTime = rawTime;
    const time = rawTime - this.startTime;

    if (stableNote && stableNote !== this.currentNote) {
      this.notes.push({ time, pitch: stableNote, frequency: stableFreq });
    }

    this.currentNote = stableNote;
  }

  /** @returns {{time: number, pitch: string, frequency: number}[]} */
  getNotes() {
    return this.notes;
  }
}
