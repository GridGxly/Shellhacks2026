import { MongoError } from 'mongodb';
import { isObject } from '@/lib/validation';

export const bad = (error: string, status = 400) => Response.json({ error }, { status });
export { isInt as int, isObject as object } from '@/lib/validation';
export const duplicate = (e: unknown) => isObject(e) && e.code === 11000;

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

/** The raw request body, refused as soon as it passes maxBytes. */
export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array | Response> {
  if (Number(request.headers.get('content-length')) > maxBytes) return bad('Body too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) return bad('Empty body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); return bad('Body too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return chunks.length === 1 ? chunks[0] : new Uint8Array(Buffer.concat(chunks));
}

/** Parses UTF-8 JSON bytes; anything but a JSON object is refused. */
export function parseJsonObject(bytes: Uint8Array): Record<string, unknown> | Response {
  try {
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return isObject(body) ? body : bad('Expected a JSON object.');
  } catch { return bad('Bad JSON.'); }
}

export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<Record<string, unknown> | Response> {
  try {
    const bytes = await readBytes(request, maxBytes);
    return bytes instanceof Response ? bytes : parseJsonObject(bytes);
  } catch { return bad('Bad JSON.'); }
}

export async function handled(work: () => Promise<Response>) {
  try { return await work(); }
  catch (e) {
    return e instanceof MongoError ? bad('Database unavailable. Try again shortly.', 503) : bad('Server error.', 500);
  }
}
