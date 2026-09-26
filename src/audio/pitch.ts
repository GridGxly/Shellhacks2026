/**
 * pitch.ts — microphone input + pitch detection (PRD §6).
 *
 * Thin TS adapter over the pitch-detection spike from the `pitch-detection`
 * branch (../pitch-engine.js, ../mic.js). That code already does mic capture,
 * gating (level/clarity/range), and McLeod pitch detection via pitchy — this
 * file just reshapes its output into the { timeMs, midi, clarity } contract
 * the rest of audio/ expects, converting frequency -> MIDI directly rather
 * than going through the note-name stabilizer (that's grade.ts's job now).
 */
import { MicPitchTracker } from '../mic.js';

export interface PitchReading {
  timeMs: number;
  midi: number | null; // null when clarity/level/range gating rejects the frame
  clarity: number;
}

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69;
}

export interface MicHandle {
  stop(): Promise<void>;
}

export async function startMic(onReading: (r: PitchReading) => void): Promise<MicHandle> {
  const tracker = new MicPitchTracker({
    onReading: (raw: { accepted: boolean; frequency: number | null; clarity: number; timestamp: number }) => {
      onReading({
        timeMs: raw.timestamp,
        midi: raw.accepted && raw.frequency != null ? freqToMidi(raw.frequency) : null,
        clarity: raw.clarity,
      });
    },
  });

  await tracker.start();
  return { stop: () => tracker.stop() };
}
