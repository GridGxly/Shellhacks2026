import { PitchEngine } from './pitch-engine.js';
import { PitchStabilizer } from './stabilizer.js';

/**
 * Runs the same detection pipeline over a decoded audio file, frame by frame,
 * so a recorded take can be replayed through the exact logic the live mic uses.
 */
export async function analyzeArrayBuffer(arrayBuffer, { bufferSize, clarityThreshold, hopSize, minRmsDb } = {}) {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const decoded = await ctx.decodeAudioData(arrayBuffer);

  // Mix to mono — the mic path is mono, so the file path should match.
  const channels = decoded.numberOfChannels;
  const samples = new Float32Array(decoded.length);
  for (let c = 0; c < channels; c += 1) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < decoded.length; i += 1) samples[i] += data[i] / channels;
  }

  const size = bufferSize ?? 2048;
  const hop = hopSize ?? Math.floor(size / 4);
  const engine = new PitchEngine({ bufferSize: size, clarityThreshold, minRmsDb });
  const stabilizer = new PitchStabilizer();
  const frames = [];

  for (let offset = 0; offset + size <= samples.length; offset += hop) {
    const reading = engine.analyze(samples.subarray(offset, offset + size), decoded.sampleRate);
    const settled = stabilizer.push(reading);
    frames.push({
      timeMs: (offset / decoded.sampleRate) * 1000,
      ...reading,
      stableNote: settled?.noteName ?? null,
      stableFreq: settled?.frequency ?? null,
    });
  }

  return {
    sampleRate: decoded.sampleRate,
    durationSec: decoded.duration,
    channels,
    bufferSize: size,
    hopSize: hop,
    frames,
  };
}

/** Collapses a frame list into contiguous runs of the same stable note. */
export function summarizeRuns(frames) {
  const runs = [];
  for (const f of frames) {
    const note = f.stableNote;
    const last = runs[runs.length - 1];
    if (last && last.noteName === note) {
      last.endMs = f.timeMs;
      last.count += 1;
      if (f.frequency != null) last.freqs.push(f.frequency);
    } else {
      runs.push({
        noteName: note,
        startMs: f.timeMs,
        endMs: f.timeMs,
        count: 1,
        freqs: f.frequency != null ? [f.frequency] : [],
      });
    }
  }
  return runs.map((r) => {
    const sorted = [...r.freqs].sort((a, b) => a - b);
    return {
      ...r,
      durationMs: r.endMs - r.startMs,
      medianFreq: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    };
  });
}
