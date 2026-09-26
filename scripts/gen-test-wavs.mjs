/**
 * Generates test .wav files so the file-analysis path can be exercised without
 * recording an instrument first. Plucked-string-like: harmonic stack with
 * per-harmonic decay, a short attack transient, and a light vibrato.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Note } from 'tonal';

const SR = 44100;

function renderNote({ freq, durSec, vibratoCents = 6, vibratoHz = 5, harmonics = 10, amp = 0.32 }) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const ratio = 2 ** ((vibratoCents * Math.sin(2 * Math.PI * vibratoHz * t)) / 1200);
    phase += (2 * Math.PI * freq * ratio) / SR;
    const attack = Math.min(1, t / 0.01);
    const release = Math.min(1, (durSec - t) / 0.06);
    let s = 0;
    for (let h = 1; h <= harmonics; h += 1) {
      s += (1 / h) * Math.exp(-t * (0.8 + h * 0.5)) * Math.sin(h * phase);
    }
    const click = t < 0.012 ? (Math.random() * 2 - 1) * Math.exp(-t * 280) * 0.5 : 0;
    out[i] = (s * attack * release + click) * amp + (Math.random() * 2 - 1) * 0.0015;
  }
  return out;
}

function silence(durSec) {
  const n = Math.floor(durSec * SR);
  const out = new Float32Array(n);
  // Room tone rather than digital silence - a real recording is never zero,
  // and the clarity threshold needs to reject this.
  for (let i = 0; i < n; i += 1) out[i] = (Math.random() * 2 - 1) * 0.004;
  return out;
}

function concat(chunks) {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function toWav(samples, sampleRate = SR) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const outDir = 'public/test-audio';
mkdirSync(outDir, { recursive: true });

const cases = {
  'single-A4.wav': () => concat([silence(0.3), renderNote({ freq: 440, durSec: 1.8 }), silence(0.3)]),
  'single-E2-low.wav': () => concat([silence(0.3), renderNote({ freq: 82.41, durSec: 1.8 }), silence(0.3)]),
  'scale-C4-C5.wav': () => concat([
    silence(0.25),
    ...['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].flatMap((nm) => [
      renderNote({ freq: Note.freq(nm), durSec: 0.65 }),
      silence(0.18),
    ]),
  ]),
  'quiet-and-noise.wav': () => concat([
    silence(0.6),
    renderNote({ freq: 220, durSec: 1.0, amp: 0.02 }),
    silence(0.6),
  ]),
};

for (const [name, make] of Object.entries(cases)) {
  const wav = toWav(make());
  writeFileSync(`${outDir}/${name}`, wav);
  console.log(`wrote ${outDir}/${name} (${(wav.length / 1024).toFixed(0)} KB)`);
}
