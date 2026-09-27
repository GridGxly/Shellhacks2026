import { Binary } from 'mongodb';
import { db, dbConfigured } from '@/lib/db';
import { sha256Hex } from './hash';

// ElevenLabs speech, cached. Taunt templates, review stops and fallback
// coaching repeat the same text constantly; each distinct line is synthesized
// once, then served from this instance's memory or the shared `ttsCache`
// collection (TTL in lib/mongo-indexes.json).
const MODEL = 'eleven_flash_v2_5';
const MAX_AUDIO_BYTES = 1024 * 1024;
const MEMORY_ENTRIES = 64;

export interface VoiceSettings { stability: number; similarity_boost: number; style: number }
export interface Speech { voiceId: string; text: string; settings: VoiceSettings }
interface TtsCacheDoc { _id: string; audio: Binary; createdAt: Date }

const memory = new Map<string, Uint8Array>();
const keyOf = (s: Speech) => sha256Hex(JSON.stringify([MODEL, s.voiceId, s.settings, s.text]));
function remember(key: string, audio: Uint8Array) {
  memory.delete(key); memory.set(key, audio);
  if (memory.size > MEMORY_ENTRIES) memory.delete(memory.keys().next().value!);
}

/** Audio already synthesized for this exact line, or null. Costs no voice budget. */
export async function cachedSpeech(speech: Speech): Promise<Uint8Array | null> {
  const key = keyOf(speech);
  const hit = memory.get(key);
  if (hit) { remember(key, hit); return hit; }
  if (!dbConfigured()) return null;
  try {
    const doc = await (await db()).collection<TtsCacheDoc>('ttsCache').findOne({ _id: key });
    if (!doc) return null;
    const audio = new Uint8Array(doc.audio.value());
    remember(key, audio);
    return audio;
  } catch { return null; } // the cache is optional; a DB hiccup just means synthesizing
}

/** Calls ElevenLabs (8 s timeout, 1 MB cap) and caches the result. Null when unconfigured or failed. */
export async function synthesize(speech: Speech): Promise<Uint8Array | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY; if (!apiKey) return null;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(speech.voiceId)}/stream?output_format=mp3_44100_64`, {
      method: 'POST', signal: controller.signal,
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speech.text, model_id: MODEL, voice_settings: speech.settings }),
    });
    if (!response.ok || !response.body) { void response.body?.cancel().catch(() => {}); return null; }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length;
        if (size > MAX_AUDIO_BYTES) { await reader.cancel(); return null; }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const audio = new Uint8Array(Buffer.concat(chunks));
    if (!audio.length) return null;
    const key = keyOf(speech);
    remember(key, audio);
    // Awaited: a serverless function may be frozen as soon as it responds.
    if (dbConfigured()) {
      try {
        await (await db()).collection<TtsCacheDoc>('ttsCache').updateOne(
          { _id: key }, { $setOnInsert: { audio: new Binary(audio), createdAt: new Date() } }, { upsert: true },
        );
      } catch { /* optional cache */ }
    }
    return audio;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
