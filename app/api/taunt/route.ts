import { pickTaunt, type TauntFacts, type TauntMoment } from '@/lib/taunts';
import type { VoiceKey } from '@/lib/content';

const VOICES: Record<VoiceKey, string> = {
  goblin: 'zauh4pbY6h1ZRErsRiAJ',
  serpent: 'xYWUvKNK6zWCgsdAK7Wi',
  choir: 'mLw8kuDeVGqVstOYjRII',
};

interface Body {
  enemy: VoiceKey;
  heat: number;
  moment: TauntMoment;
  facts: TauntFacts;
  used: string[];
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const taunt = pickTaunt(body.enemy, body.heat, body.moment, body.facts, body.used ?? []);
  if (!taunt) return new Response(null, { status: 204 });

  const headers = {
    'X-Taunt-Id': taunt.id,
    'X-Taunt-Text': encodeURIComponent(taunt.text),
    'Cache-Control': 'no-store',
  };

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response(null, { status: 200, headers });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICES[body.enemy]}/stream?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: taunt.text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.7 },
      }),
    },
  );

  // Voice failed: still return the line so the subtitle shows.
  if (!res.ok || !res.body) return new Response(null, { status: 200, headers });

  return new Response(res.body, { status: 200, headers: { ...headers, 'Content-Type': 'audio/mpeg' } });
}
