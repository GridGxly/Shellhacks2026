import { MongoError } from 'mongodb';

export const bad = (error: string, status = 400) => Response.json({ error }, { status });
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const int = (v: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= lo && (v as number) <= hi;
export const duplicate = (e: unknown) => object(e) && e.code === 11000;

export function mutation(request: Request, json = true) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== (request.headers.get('host') ?? new URL(request.url).host)) return bad('Cross-origin request denied.', 403);
    } catch { return bad('Cross-origin request denied.', 403); }
  }
  if (json && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return bad('Expected application/json.', 415);
  return null;
}

export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<Record<string, unknown> | Response> {
  try {
    if (Number(request.headers.get('content-length')) > maxBytes) return bad('Body too large.', 413);
    const reader = request.body?.getReader();
    if (!reader) return bad('Bad JSON.');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0, text = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { void reader.cancel().catch(() => {}); return bad('Body too large.', 413); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    const body: unknown = JSON.parse(text);
    return object(body) ? body : bad('Expected a JSON object.');
  } catch { return bad('Bad JSON.'); }
}

export async function handled(work: () => Promise<Response>) {
  try { return await work(); }
  catch (e) {
    return e instanceof MongoError ? bad('Database unavailable. Try again shortly.', 503) : bad('Server error.', 500);
  }
}
