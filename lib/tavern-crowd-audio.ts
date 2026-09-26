'use client';
import { ac, effectsOutput, settings } from './audio';

// Generated once with ElevenLabs Sound Effects v2. These bundled, wordless
// reactions never call a generation service during a show.
export const TAVERN_CROWD_FILES = {
  applause: '/audio/sfx/tavern-applause.mp3',
  boo: '/audio/sfx/tavern-boo.mp3',
  gasp: '/audio/sfx/tavern-gasp.mp3',
  yelp: '/audio/sfx/tavern-yelp.mp3',
} as const;
export type TavernCrowdEffect = keyof typeof TAVERN_CROWD_FILES;
export interface TavernCrowdCue { effect: TavernCrowdEffect; at: number; volume: number; pan?: number }

/** Scene events own the cue times, so duel verdicts can supply their own targets. */
export function tavernVerdictCrowdCues(approved: boolean, tomatoHits: readonly number[] = [], hookYankAt?: number): TavernCrowdCue[] {
  if (approved) return [{ effect: 'applause', at: 0, volume: .64 }];
  const cues: TavernCrowdCue[] = [{ effect: 'boo', at: 0, volume: .48 }];
  if (tomatoHits.length) {
    cues.push({ effect: 'gasp', at: Math.min(...tomatoHits), volume: .64 });
    if (hookYankAt === undefined) cues.push({ effect: 'yelp', at: Math.max(...tomatoHits), volume: .48 });
  }
  if (hookYankAt !== undefined) cues.push({ effect: 'yelp', at: hookYankAt, volume: .62 });
  return cues;
}

const buffers = new Map<TavernCrowdEffect, Promise<AudioBuffer | null>>();
function load(effect: TavernCrowdEffect): Promise<AudioBuffer | null> {
  const cached = buffers.get(effect); if (cached) return cached;
  const buffer = fetch(TAVERN_CROWD_FILES[effect]).then(async response => {
    if (!response.ok) throw new Error('Crowd effect unavailable');
    return ac().decodeAudioData(await response.arrayBuffer());
  }).catch(() => { buffers.delete(effect); return null; });
  buffers.set(effect, buffer); return buffer;
}
export function preloadTavernCrowd() {
  Object.keys(TAVERN_CROWD_FILES).forEach(effect => { void load(effect as TavernCrowdEffect); });
}

/** Every queued and sounding source belongs to this verdict and its lifetime. */
export function playTavernCrowd(cues: readonly TavernCrowdCue[], signal: AbortSignal, verdictAt: number): () => void {
  const sources = new Set<AudioBufferSourceNode>();
  const nodes = new Set<AudioNode>();
  let stopped = signal.aborted;
  const stop = () => {
    if (stopped) return;
    stopped = true; signal.removeEventListener('abort', stop);
    sources.forEach(source => { try { source.stop(); } catch {} source.disconnect(); });
    nodes.forEach(node => node.disconnect()); sources.clear(); nodes.clear();
  };
  if (stopped) return stop;
  signal.addEventListener('abort', stop, { once: true });
  for (const cue of cues) {
    if (settings.sfx <= 0) break;
    void load(cue.effect).then(buffer => {
      if (!buffer || stopped || signal.aborted || settings.sfx <= 0) return;
      const remainingMs = verdictAt + cue.at - Date.now();
      // A late download must not attach a gasp/yelp to an unrelated later pose.
      if (remainingMs < -180) return;
      const ctx = ac();
      const source = ctx.createBufferSource(); source.buffer = buffer;
      const gain = ctx.createGain(); gain.gain.value = cue.volume;
      const pan = ctx.createStereoPanner(); pan.pan.value = cue.pan ?? 0;
      source.connect(gain).connect(pan).connect(effectsOutput());
      sources.add(source); nodes.add(gain); nodes.add(pan);
      source.onended = () => {
        source.disconnect(); gain.disconnect(); pan.disconnect();
        sources.delete(source); nodes.delete(gain); nodes.delete(pan);
      };
      source.start(ctx.currentTime + Math.max(0, remainingMs) / 1000);
    });
  }
  return stop;
}
