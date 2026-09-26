'use client';
// Audio engine: music (Ode to Joy recording + chiptune arrangements),
// synthesized chiptune SFX, ElevenLabs SFX files, metronome, enemy voices.
// Nothing here may play while the mic is recording (PRD §7a).

export interface AudioSettings {
  music: number; // 0..1
  sfx: number;
  voice: number;
  trashTalk: 'spicy' | 'mild' | 'off';
  metronome: 'click' | 'flash' | 'off';
  countIn: 2 | 4;
  approach: 'on' | 'off'; // osu-style closing circles on the staff (on for beginners) vs the sweeping bar
}

export const settings: AudioSettings = {
  music: 0.6,
  sfx: 0.8,
  voice: 0.7,
  trashTalk: 'spicy',
  metronome: 'click',
  countIn: 4,
  approach: 'on',
};

let ctx: AudioContext | null = null;
let musicGain: GainNode;
let chipGain: GainNode;
let sfxGain: GainNode;

export function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    musicGain = ctx.createGain();
    chipGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.gain.value = settings.music;
    sfxGain.gain.value = settings.sfx;
    chipGain.gain.value = 0.22;
    chipGain.connect(musicGain);
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Apply and persist (same localStorage key Game.tsx loads on boot). */
export function saveSettings(next: Partial<AudioSettings>) {
  applySettings(next);
  try { localStorage.setItem('stc.settings.v1', JSON.stringify(settings)); } catch { /* ignore */ }
}

export function applySettings(next: Partial<AudioSettings>) {
  Object.assign(settings, next);
  if (!ctx) return;
  musicGain.gain.setTargetAtTime(musicMuted ? 0 : settings.music * (ducked ? 0.35 : 1), ctx.currentTime, 0.05);
  sfxGain.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.05);
  voices.forEach((v) => (v.volume = Math.min(1, settings.voice)));
}

// ---------------------------------------------------------------- music

export type Track = 'title' | 'map' | 'battle' | 'boss' | 'encore' | 'final' | 'none';

const FILES: Partial<Record<Track, string>> = {
  title: '/audio/music/ode-title.m4a',
  encore: '/audio/music/ode-choral.m4a',
  final: '/audio/music/ode-coda.m4a',
};

let current: Track = 'none';
let fileEl: HTMLAudioElement | null = null;
const fileSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
let chipTimer: number | null = null;
let ducked = false;
let musicMuted = false;

export function playMusic(track: Track) {
  if (track === current) return;
  const c = ac();
  current = track;
  stopChip();
  if (fileEl) {
    const old = fileEl;
    fileEl = null;
    fadeElement(old, 0, 400, () => old.pause());
  }
  if (track === 'none') return;
  const file = FILES[track];
  if (file) {
    const el = new Audio(file);
    el.loop = track !== 'final';
    el.crossOrigin = 'anonymous';
    const src = c.createMediaElementSource(el);
    fileSources.set(el, src);
    src.connect(musicGain);
    el.volume = 0;
    void el.play().catch(() => {});
    fadeElement(el, 1, 800);
    fileEl = el;
  } else {
    startChip(track);
  }
}

function fadeElement(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** Lower music while an enemy talks. */
export function duck(on: boolean) {
  ducked = on;
  applySettings({});
}

/** Hard mute for count-in + recording so nothing leaks into the mic. */
export function muteMusic(on: boolean) {
  musicMuted = on;
  if (!ctx) return;
  musicGain.gain.setTargetAtTime(on ? 0 : settings.music * (ducked ? 0.35 : 1), ctx.currentTime, on ? 0.02 : 0.3);
}

// Chiptune arrangements of Ode to Joy (D major, degrees -> midi).
const D = 62;
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const dg = (d: number, scale = MAJ) => D + Math.floor(d / 7) * 12 + scale[((d % 7) + 7) % 7];
const ODE: [number, number][] = [
  [2, 1], [2, 1], [3, 1], [4, 1], [4, 1], [3, 1], [2, 1], [1, 1],
  [0, 1], [0, 1], [1, 1], [2, 1], [2, 1.5], [1, 0.5], [1, 2],
  [2, 1], [2, 1], [3, 1], [4, 1], [4, 1], [3, 1], [2, 1], [1, 1],
  [0, 1], [0, 1], [1, 1], [2, 1], [1, 1.5], [0, 0.5], [0, 2],
];
const BASS = [0, 4, 0, 4, 0, 4, 4, 0]; // one root per bar (I/V)

interface ChipStyle {
  tempo: number;
  lead: OscillatorType;
  bass: OscillatorType;
  scale: number[];
  octave: number;
  drums: boolean;
  leadVol: number;
}
const STYLES: Partial<Record<Track, ChipStyle>> = {
  map: { tempo: 84, lead: 'triangle', bass: 'triangle', scale: MAJ, octave: 12, drums: false, leadVol: 0.5 },
  battle: { tempo: 138, lead: 'square', bass: 'triangle', scale: MAJ, octave: 12, drums: true, leadVol: 0.28 },
  boss: { tempo: 112, lead: 'sawtooth', bass: 'square', scale: MIN, octave: 0, drums: true, leadVol: 0.2 },
};

function startChip(track: Track) {
  const style = STYLES[track];
  if (!style) return;
  const c = ac();
  const spb = 60 / style.tempo;
  const loopBeats = ODE.reduce((a, [, d]) => a + d, 0);
  let loopStart = c.currentTime + 0.1;
  let idx = 0;
  let beatInLoop = 0;
  let scheduledBars = new Set<number>();
  const tick = () => {
    const horizon = c.currentTime + 0.25;
    while (loopStart + beatInLoop * spb < horizon) {
      const [d, dur] = ODE[idx];
      const t = loopStart + beatInLoop * spb;
      tone(dg(d, style.scale) + style.octave, t, dur * spb * 0.92, style.lead, style.leadVol, chipGain);
      const bar = Math.floor(beatInLoop / 4);
      if (!scheduledBars.has(bar)) {
        scheduledBars.add(bar);
        const root = dg(BASS[bar % 8], style.scale) - 24;
        for (let b = 0; b < 4; b++) {
          const bt = loopStart + (bar * 4 + b) * spb;
          tone(root + (b % 2 ? 7 : 0), bt, spb * 0.8, style.bass, 0.35, chipGain);
          if (style.drums) {
            if (b % 2 === 0) kick(bt, chipGain);
            else snare(bt, chipGain);
            hat(bt + spb / 2, chipGain);
          }
        }
      }
      beatInLoop += dur;
      idx++;
      if (idx >= ODE.length) {
        idx = 0;
        loopStart += loopBeats * spb;
        beatInLoop = 0;
        scheduledBars = new Set();
      }
    }
  };
  tick();
  chipTimer = window.setInterval(tick, 60);
}

function stopChip() {
  if (chipTimer) window.clearInterval(chipTimer);
  chipTimer = null;
  if (ctx) {
    // Cut already-scheduled chip notes by swapping the chip bus.
    chipGain.disconnect();
    chipGain = ctx.createGain();
    chipGain.gain.value = 0.22;
    chipGain.connect(musicGain);
  }
}

// ---------------------------------------------------------------- synth helpers

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function tone(midi: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, slideTo?: number) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(mtof(midi), t);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(mtof(slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(t: number, dur: number, vol: number, out: AudioNode, hp = 1000, lp = 12000) {
  const c = ac();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f1 = c.createBiquadFilter();
  f1.type = 'highpass';
  f1.frequency.value = hp;
  const f2 = c.createBiquadFilter();
  f2.type = 'lowpass';
  f2.frequency.value = lp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f1).connect(f2).connect(g).connect(out);
  s.start(t);
  s.stop(t + dur + 0.02);
}
const kick = (t: number, out: AudioNode) => tone(48, t, 0.14, 'sine', 0.8, out, 28);
const snare = (t: number, out: AudioNode) => noise(t, 0.12, 0.35, out, 1500);
const hat = (t: number, out: AudioNode) => noise(t, 0.04, 0.12, out, 7000);

// ---------------------------------------------------------------- SFX

export type Sfx =
  | 'hover' | 'click' | 'back' | 'deal' | 'drag' | 'drop' | 'flip'
  | 'tick' | 'tickAccent' | 'noteHit' | 'noteMiss' | 'stampHit' | 'stampMiss'
  | 'zap' | 'impact' | 'damage' | 'hurt' | 'coin' | 'upgrade' | 'lockShatter'
  | 'wipe' | 'pop' | 'denied';

export function sfx(name: Sfx, when = 0) {
  const c = ac();
  const t = c.currentTime + when;
  const o = sfxGain;
  switch (name) {
    case 'hover': return tone(84, t, 0.04, 'square', 0.08, o);
    case 'click': tone(76, t, 0.05, 'square', 0.15, o); return tone(88, t + 0.05, 0.07, 'square', 0.15, o);
    case 'back': tone(81, t, 0.05, 'square', 0.14, o); return tone(72, t + 0.05, 0.08, 'square', 0.14, o);
    case 'deal': return noise(t, 0.08, 0.18, o, 2500, 9000);
    case 'drag': return tone(67, t, 0.1, 'triangle', 0.2, o, 74);
    case 'drop': tone(60, t, 0.08, 'square', 0.2, o, 48); return noise(t, 0.1, 0.15, o, 800);
    case 'flip': noise(t, 0.12, 0.2, o, 3000); return tone(72, t + 0.08, 0.2, 'triangle', 0.25, o, 84);
    case 'tick': return tone(96, t, 0.03, 'square', 0.25, o);
    case 'tickAccent': return tone(103, t, 0.05, 'square', 0.35, o);
    case 'noteHit': tone(88, t, 0.08, 'triangle', 0.2, o); return tone(95, t + 0.05, 0.12, 'triangle', 0.18, o);
    case 'noteMiss': return tone(45, t, 0.14, 'square', 0.18, o, 38);
    case 'stampHit': [72, 76, 79, 84].forEach((m, i) => tone(m, t + i * 0.06, 0.16, 'square', 0.18, o)); return;
    case 'stampMiss': noise(t, 0.2, 0.3, o, 200, 2000); return tone(52, t, 0.3, 'square', 0.2, o, 40);
    case 'zap': return [79, 83, 86, 91].forEach((m, i) => tone(m, t + i * 0.035, 0.08, 'square', 0.12, o));
    case 'impact': noise(t, 0.25, 0.5, o, 80, 5000); return tone(40, t, 0.25, 'sine', 0.7, o, 24);
    case 'damage': return [0, 1, 2, 3].forEach((i) => tone(60 - i * 2, t + i * 0.04, 0.05, 'square', 0.12, o));
    case 'hurt': tone(64, t, 0.18, 'sawtooth', 0.25, o, 40); return noise(t, 0.15, 0.25, o, 600);
    case 'coin': tone(83, t, 0.06, 'square', 0.16, o); return tone(88, t + 0.06, 0.18, 'square', 0.16, o);
    case 'upgrade': return [72, 76, 79, 84, 88].forEach((m, i) => tone(m, t + i * 0.05, 0.12, 'triangle', 0.22, o));
    case 'lockShatter': for (let i = 0; i < 6; i++) tone(90 - i * 3, t + i * 0.03, 0.06, 'square', 0.12, o); return noise(t, 0.3, 0.3, o, 3000);
    case 'wipe': return noise(t, 0.35, 0.2, o, 1200, 6000);
    case 'pop': return tone(79, t, 0.06, 'square', 0.18, o, 91);
    case 'denied': tone(55, t, 0.08, 'square', 0.18, o); return tone(50, t + 0.09, 0.12, 'square', 0.18, o);
  }
}

/** Metronome click at an exact AudioContext time. */
export function clickAt(time: number, accent: boolean) {
  if (settings.metronome !== 'click') return;
  tone(accent ? 103 : 96, time, accent ? 0.05 : 0.03, 'square', accent ? 0.35 : 0.25, sfxGain);
}

const buffers = new Map<string, Promise<AudioBuffer>>();
function load(url: string) {
  if (!buffers.has(url)) {
    buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => ac().decodeAudioData(b)));
  }
  return buffers.get(url)!;
}
export function preload(urls: string[]) {
  urls.forEach((u) => void load(u).catch(() => {}));
}
export async function playFile(url: string, vol = 1) {
  try {
    const buf = await load(url);
    const c = ac();
    const s = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = vol;
    s.buffer = buf;
    s.connect(g).connect(sfxGain);
    s.start();
  } catch {
    /* missing file: stay silent */
  }
}

// ---------------------------------------------------------------- voices

const voices = new Set<HTMLAudioElement>();

/** Plays an enemy line. The Choir is 3 detuned, offset copies. Resolves when done. */
export function playVoice(src: string, choir: boolean): Promise<void> {
  stopVoices();
  if (settings.voice <= 0) return Promise.resolve();
  duck(true);
  const copies = choir ? [[1, 0, 1], [0.96, 40, 0.6], [1.04, 80, 0.5]] : [[1, 0, 1]];
  const done = copies.map(
    ([rate, delay, vol]) =>
      new Promise<void>((resolve) => {
        const el = new Audio(src);
        el.preservesPitch = false;
        el.playbackRate = rate;
        el.volume = Math.min(1, settings.voice * vol);
        voices.add(el);
        el.onended = el.onerror = () => {
          voices.delete(el);
          resolve();
        };
        window.setTimeout(() => void el.play().catch(() => resolve()), delay);
      }),
  );
  return Promise.all(done).then(() => duck(false));
}

export function stopVoices() {
  voices.forEach((v) => {
    v.pause();
    v.onended?.(new Event('ended'));
  });
  voices.clear();
  duck(false);
}
