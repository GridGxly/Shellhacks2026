import { guarded, voiceBudget } from '@/lib/server/api-guard';
import { pickTaunt, type TauntFacts, type TauntMoment } from '@/lib/taunts';
import { ENEMIES, type VoiceKey } from '@/lib/content';
import { bad, int, mutation, object, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import villains from '@/lib/villain-voices.json';

// Every foe has its own ElevenLabs voice; unknown ids fall back to their persona's voice.
type Voice = { id: string; settings: Record<string, number> };
const VOICES = villains.voices as Record<string, Voice>;
const voiceFor = (id: string, persona: VoiceKey) => VOICES[id] ?? VOICES[persona];

async function speak(voice: Voice, text: string, signal: AbortSignal) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/stream?output_format=mp3_44100_64`, {
    method: 'POST', signal,
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: villains.model, voice_settings: voice.settings }),
  });
}

function factsFrom(v: unknown): TauntFacts | null {
  if (!object(v)) return null;
  const facts: Record<string, string | number> = {};
  for (const key of ['wrongCount', 'missCount', 'silentCount', 'totalNotes', 'accuracy', 'hp', 'failCount', 'bar']) {
    const n = v[key];
    if (n === undefined && key === 'bar') continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > (key === 'accuracy' ? 100 : 1000)) return null;
    facts[key] = Math.round(n);
  }
  for (const key of ['wrongNote', 'expectedNote', 'timing', 'cardType']) {
    const s = v[key];
    if (s === undefined && key !== 'cardType') continue;
    if (typeof s !== 'string' || s.length > 12) return null;
    if (key === 'timing' && s !== 'rushed' && s !== 'dragged') return null;
    facts[key] = s.replace(/[^a-zA-Z0-9 #♯♭-]/g, '').slice(0, 12);
  }
  return facts as unknown as TauntFacts;
}

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 4096); if (b instanceof Response) return b;
    const facts = factsFrom(b.facts);
    const foe = ENEMIES.find((e) => e.id === b.enemyId && e.voice === b.enemy);
    // Fight start: a library voice's first request takes seconds, so wake it before the first heckle.
    if (b.warm === true && foe) {
      if (!process.env.ELEVENLABS_API_KEY || await limit(`taunt-warm:${clientIp(request)}`, 30, 600_000)) return new Response(null, { status: 204 });
      const res = await speak(voiceFor(foe.id, foe.voice), 'Hm.', AbortSignal.timeout(8000)).catch(() => null);
      void res?.body?.cancel().catch(() => {});
      return new Response(null, { status: 204 });
    }
    if (!foe || !int(b.heat, 0, 3) || !['miss', 'enemyTurn', 'hit'].includes(b.moment as string) || !facts || !Array.isArray(b.used) || b.used.length > 50 || b.used.some((s) => typeof s !== 'string' || s.length > 16)) return bad('Bad taunt.');
    // A whole venue shares one IP, and a climb heckles ~100 times: these only stop floods.
    const local = await limit(`taunt:${clientIp(request)}`, 300, 600_000); if (local) return local;
    const global = await limit('taunt:global', 600, 60_000); if (global) return global;
    const taunt = pickTaunt(foe.voice, foe.id, b.heat, b.moment as TauntMoment, facts, b.used as string[]);
    if (!taunt) return new Response(null, { status: 204 });
    const text = taunt.text.slice(0, 200);
    const headers = { 'X-Taunt-Id': taunt.id, 'X-Taunt-Text': encodeURIComponent(text), 'Cache-Control': 'no-store' };
    const fallback = () => new Response(null, { status: 200, headers });
    // Out of voice budget still heckles: the subtitle is free.
    if (await voiceBudget(request)) return fallback();
    if (!process.env.ELEVENLABS_API_KEY) return fallback();
    const controller = new AbortController();
    // Under the client's wait, so a slow voice still delivers the subtitle.
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await speak(voiceFor(foe.id, foe.voice), text, controller.signal);
      if (!res.ok || !res.body) { void res.body?.cancel().catch(() => {}); return fallback(); }
      // Read within the timeout so failures mid-audio still preserve subtitles.
      const audio = await res.arrayBuffer();
      return new Response(audio, { status: 200, headers: { ...headers, 'Content-Type': 'audio/mpeg' } });
    } catch { return fallback(); }
    finally { clearTimeout(timer); }
  });
}
