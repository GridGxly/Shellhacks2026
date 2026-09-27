import { guarded, voiceBudget } from '@/lib/server/api-guard';
import { pickTaunt, type TauntFacts, type TauntMoment } from '@/lib/taunts';
import { ENEMIES, type VoiceKey } from '@/lib/content';
import { bad, int, mutation, object, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { cachedSpeech, synthesize, type Speech } from '@/lib/server/tts';

const VOICES: Record<VoiceKey, string> = {
  goblin: 'zauh4pbY6h1ZRErsRiAJ',
  serpent: 'xYWUvKNK6zWCgsdAK7Wi',
  choir: 'mLw8kuDeVGqVstOYjRII',
};

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
    if (!ENEMIES.some((e) => e.voice === b.enemy) || !int(b.heat, 0, 3) || !['miss', 'enemyTurn', 'hit'].includes(b.moment as string) || !facts || !Array.isArray(b.used) || b.used.length > 50 || b.used.some((s) => typeof s !== 'string' || s.length > 16)) return bad('Bad taunt.');
    const local = await limit(`taunt:${clientIp(request)}`, 30, 600_000); if (local) return local;
    const global = await limit('taunt:global', 120, 60_000); if (global) return global;
    const taunt = pickTaunt(b.enemy as VoiceKey, b.heat, b.moment as TauntMoment, facts, b.used as string[]);
    if (!taunt) return new Response(null, { status: 204 });
    const text = taunt.text.slice(0, 200);
    const headers = { 'X-Taunt-Id': taunt.id, 'X-Taunt-Text': encodeURIComponent(text), 'Cache-Control': 'no-store' };
    const fallback = () => new Response(null, { status: 200, headers });
    if (!process.env.ELEVENLABS_API_KEY) return fallback();
    const speech: Speech = { voiceId: VOICES[b.enemy as VoiceKey], text, settings: { stability: 0.3, similarity_boost: 0.8, style: 0.7 } };
    const play = (audio: Uint8Array) => new Response(new Uint8Array(audio), { status: 200, headers: { ...headers, 'Content-Type': 'audio/mpeg' } });
    // Most taunt lines repeat; only a line never voiced before spends the voice budget.
    const cached = await cachedSpeech(speech); if (cached) return play(cached);
    const budget = await voiceBudget(request); if (budget) return budget;
    // Failures still return the subtitle headers, so the line shows as text.
    const audio = await synthesize(speech);
    return audio ? play(audio) : fallback();
  });
}
