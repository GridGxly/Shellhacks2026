/**
 * pitch.ts — microphone input + pitch detection (PRD §6).
 *
 * Poll Pitchy every PITCH_POLL_MS; ignore readings below MIN_CLARITY.
 * Convert frequency -> MIDI:  midi = 12 * log2(freq / 440) + 69
 *
 * NOTE: your friend already built a pitch spike on the `pitch-detection` branch
 * (mic.js, pitch-engine.js, stabilizer.js). Fold that logic in here rather than
 * rewriting it. TS can call plain JS directly.
 *
 * TODO(team): getUserMedia -> AudioContext -> Pitchy analyser loop.
 */

export interface PitchReading {
  timeMs: number;
  midi: number | null; // null when clarity is too low / silent
  clarity: number;
}

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

export async function startMic(_onReading: (r: PitchReading) => void): Promise<void> {
  throw new Error('pitch.ts not implemented — reuse the pitch-detection branch');
}
