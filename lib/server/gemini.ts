import { createHash } from 'node:crypto';

// Server-only Gemini call: structured JSON out, cached by request so the same
// question is never paid for twice (`fresh` skips the cache on purpose).

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// Tried in order when the main model is overloaded (503). Override with a
// comma list in GEMINI_FALLBACKS.
const FALLBACKS = () => (process.env.GEMINI_FALLBACKS || 'gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite').split(',').map((m) => m.trim()).filter(Boolean);
const g = globalThis as unknown as { _geminiCache?: Map<string, unknown>; _geminiCooling?: Map<string, number> };
const cache = (g._geminiCache ??= new Map());
// A 503 can take many seconds to come back, so a model that just said
// "overloaded" is skipped for a minute instead of being asked again.
const cooling = (g._geminiCooling ??= new Map<string, number>());
const COOLDOWN_MS = 60_000;

export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

export interface GeminiResult<T> {
  data: T;
  cached: boolean;
  usage: { in: number; out: number } | null;
  model: string;
}

export class GeminiError extends Error {}

// Thinking tokens are billed as output and add latency; simple tasks don't need them.
export type Thinking = 'off' | 'low';
const thinkingConfig = (t: Thinking) => (t === 'off' ? { thinkingBudget: 0 } : { thinkingLevel: 'low' });

export async function geminiJson<T>(prompt: string, schema: object, fresh = false, thinking: Thinking = 'off'): Promise<GeminiResult<T>> {
  // Cache by question, not model: an answer from a fallback model is still an answer.
  const id = createHash('sha256').update(prompt + JSON.stringify(schema)).digest('hex');
  const hit = cache.get(id) as { data: T; model: string } | undefined;
  if (!fresh && hit) return { data: hit.data, cached: true, usage: null, model: hit.model };

  // A model can be unavailable three ways, none billed: 503 (overloaded), 429
  // (its quota is used up — free-tier quotas are per model, e.g. 20/day), or 400
  // (this model doesn't accept part of the request, e.g. a schema feature).
  // Either way move down the chain and skip that model for a while.
  // Any other error (bad request, auth) stops immediately.
  const all = [MODEL(), ...FALLBACKS().filter((m) => m !== MODEL())];
  const now = Date.now();
  const ready = all.filter((m) => (cooling.get(m) ?? 0) <= now);
  const chain = ready.length ? ready : all; // everything cooling: try them all anyway
  for (let i = 0; i < chain.length; i++) {
    try {
      return await callOnce<T>(chain[i], id, prompt, schema, fresh, thinking);
    } catch (e) {
      if (!(e instanceof OverloadedError)) throw e;
      cooling.set(chain[i], Date.now() + Math.max(COOLDOWN_MS, e.retryAfterMs));
      if (i === chain.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        try { return await callOnce<T>(chain[i], id, prompt, schema, fresh, thinking); }
        catch (e2) { throw e2 instanceof OverloadedError ? new GeminiError(`Every Gemini model is overloaded or out of quota right now (${chain.join(', ')}). Try again in a minute.`) : e2; }
      }
    }
  }
  throw new GeminiError('No Gemini model configured.');
}

class OverloadedError extends Error {
  constructor(message: string, readonly retryAfterMs = 0) { super(message); }
}

/** Google's suggested wait, e.g. details[].retryDelay = "38s". */
function retryAfter(body: { error?: { details?: { retryDelay?: string }[] } } | null): number {
  const d = body?.error?.details?.find((x) => x.retryDelay)?.retryDelay;
  return d ? Math.ceil(parseFloat(d) * 1000) || 0 : 0;
}

async function callOnce<T>(model: string, id: string, prompt: string, schema: object, fresh: boolean, thinking: Thinking): Promise<GeminiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: fresh ? 1 : 0.7, thinkingConfig: thinkingConfig(thinking) },
      }),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 503) throw new OverloadedError(`${model} overloaded (503)`);
    if (res.status === 429) throw new OverloadedError(`${model} out of quota (429)`, retryAfter(body));
    // Models differ in which schema features they accept; a 400 on one is worth trying on the next.
    if (res.status === 400) throw new OverloadedError(`${model} rejected the request (400): ${body?.error?.message ?? ''}`.slice(0, 200));
    if (!res.ok) throw new GeminiError(`Gemini ${res.status} (${model}): ${body?.error?.message ?? 'request failed'}`.slice(0, 300));
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') throw new GeminiError('Gemini returned no content.');
    const data = JSON.parse(text) as T;
    cache.set(id, { data, model });
    const u = body.usageMetadata;
    return { data, cached: false, usage: u ? { in: u.promptTokenCount ?? 0, out: u.candidatesTokenCount ?? 0 } : null, model };
  } catch (e) {
    if (e instanceof GeminiError || e instanceof OverloadedError) throw e;
    throw new GeminiError(controller.signal.aborted ? 'Gemini timed out.' : 'Gemini unreachable or returned bad JSON.');
  } finally {
    clearTimeout(timer);
  }
}
