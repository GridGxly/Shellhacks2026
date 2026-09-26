import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5175/', { waitUntil: 'networkidle' });

const out = await p.evaluate(async () => {
  const { analyzeArrayBuffer, summarizeRuns } = await import('/src/analyze-file.js');
  const { PitchEngine, describeFrequency } = await import('/src/pitch-engine.js');
  const load = async n => (await (await fetch('/test-audio/' + n)).arrayBuffer());
  const R = {};

  // 1. Buffer size sweep on the low note.
  R.bufferSweep = {};
  const lowBuf = await load('single-E2-low.wav');
  for (const size of [1024, 2048, 4096, 8192]) {
    const r = await analyzeArrayBuffer(lowBuf.slice(0), { bufferSize: size });
    const runs = summarizeRuns(r.frames).filter(x => x.noteName && x.durationMs >= 40);
    const acc = r.frames.filter(f => f.accepted);
    const cents = acc.map(f => f.cents).filter(c => c != null);
    R.bufferSweep[size] = {
      runs: runs.map(x => x.noteName + '@' + x.medianFreq.toFixed(1)),
      nRuns: runs.length,
      windowMs: +(size / r.sampleRate * 1000).toFixed(1),
      centsSpread: cents.length ? +(Math.max(...cents) - Math.min(...cents)).toFixed(1) : null,
    };
  }

  // 2. Attack: how long until the note name is right and stays right.
  R.attack = {};
  for (const [name, expect] of [['single-A4.wav','A4'], ['single-E2-low.wav','E2'], ['scale-C4-C5.wav','C4']]) {
    const r = await analyzeArrayBuffer(await load(name), { bufferSize: 2048 });
    const onset = r.frames.findIndex(f => f.rms > 0.02);
    const firstAcc = r.frames.findIndex((f, i) => i >= onset && f.accepted);
    const firstRight = r.frames.findIndex((f, i) => i >= onset && f.noteName === expect);
    const firstStable = r.frames.findIndex((f, i) => i >= onset && f.stableNote === expect);
    const onsetMs = onset < 0 ? null : r.frames[onset].timeMs;
    R.attack[name] = {
      onsetMs: Math.round(onsetMs),
      rawCorrectAfterMs: Math.round(r.frames[firstRight].timeMs - onsetMs),
      stableCorrectAfterMs: Math.round(r.frames[firstStable].timeMs - onsetMs),
      wrongNotesBeforeSettle: r.frames.slice(onset, firstStable).filter(f => f.accepted && f.noteName !== expect).map(f => f.noteName),
    };
  }

  // 3. Flicker during sustain (raw vs stabilized), excluding attack+release.
  R.flicker = {};
  for (const name of ['single-A4.wav', 'single-E2-low.wav']) {
    const r = await analyzeArrayBuffer(await load(name), { bufferSize: 2048 });
    const acc = r.frames.filter(f => f.accepted);
    const mid = acc.slice(3, Math.floor(acc.length * 0.8));
    const raw = {}, stab = {};
    for (const f of mid) { raw[f.noteName] = (raw[f.noteName]||0)+1; if (f.stableNote) stab[f.stableNote] = (stab[f.stableNote]||0)+1; }
    R.flicker[name] = { frames: mid.length, raw, stabilized: stab };
  }

  // 4. Octave errors across the full range, synthetic harmonic tones.
  const eng = new PitchEngine({ bufferSize: 4096 });
  // MIDI -> Hz directly, so this does not depend on a bare module specifier.
  const targets = [
    ['E1',28],['A1',33],['E2',40],['A2',45],['E3',52],['A3',57],['C4',60],
    ['E4',64],['A4',69],['C5',72],['A5',81],['C6',84],['A6',93],
  ];
  R.octave = [];
  for (const [nm, midi] of targets) {
    const f = 440 * Math.pow(2, (midi - 69) / 12), n = 4096, buf = new Float32Array(n);
    for (let h=1; h<=12; h++) for (let i=0;i<n;i++) buf[i] += (1/h)*Math.sin(2*Math.PI*f*h*i/44100);
    let m=0; for (const v of buf) m=Math.max(m,Math.abs(v));
    for (let i=0;i<n;i++) buf[i]=buf[i]/m*0.3;
    const res = eng.analyze(buf, 44100);
    R.octave.push({ played: nm, got: res.noteName, ok: res.noteName === nm, cents: res.cents != null ? +res.cents.toFixed(1) : null });
  }

  // 5. Noise rejection across thresholds.
  R.noise = {};
  for (const thr of [0.7, 0.8, 0.85, 0.9]) {
    const e2 = new PitchEngine({ bufferSize: 2048, clarityThreshold: thr });
    let fp = 0;
    for (let k=0;k<300;k++) {
      const nb = Float32Array.from({length:2048}, () => (Math.random()*2-1)*0.004);
      if (e2.analyze(nb, 44100).accepted) fp++;
    }
    R.noise['thr' + thr] = fp + '/300';
  }
  // and against the real quiet file's silent lead-in
  const qr = await analyzeArrayBuffer(await load('quiet-and-noise.wav'), { bufferSize: 2048 });
  R.noise.quietFileLeadIn = qr.frames.filter(f => f.timeMs < 550 && f.accepted).length + '/' + qr.frames.filter(f => f.timeMs < 550).length;
  R.noise.rejectReasons = qr.frames.filter(f => f.timeMs < 550).reduce((a,f) => (a[f.rejectedBy ?? 'accepted'] = (a[f.rejectedBy ?? 'accepted']||0)+1, a), {});

  return R;
});

console.log(JSON.stringify(out, null, 2));
console.log('\npage errors:', errs.length ? errs : 'none');
await b.close();
