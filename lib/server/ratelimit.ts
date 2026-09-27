import { createHash } from 'node:crypto';
import { db, dbConfigured } from '@/lib/db';
import { bad, duplicate } from './http';

interface LimitDoc { _id: string; count: number; expiresAt: Date }
const memory = new Map<string, LimitDoc>();
export const clientIp = (r: Request) => {
  // Vercel overwrites this header; do not trust a client-supplied IP in production.
  const raw = process.env.VERCEL ? r.headers.get('x-vercel-forwarded-for') : r.headers.get('x-forwarded-for') || r.headers.get('x-real-ip');
  return createHash('sha256').update((raw?.split(',')[0].trim() || 'unknown').slice(0,128)).digest('hex');
};
const denied = new Map<string, number>();
function cooldown(until: number, now: number) {
  const response = bad('Too many attempts. Please retry after the cooldown.', 429);
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil((until - now) / 1000))));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

// Window is part of the key: TTL deletion need not happen at the boundary.
export async function limit(key: string, max: number, windowMs: number, consume = true) {
  const now = Date.now();
  const cached = denied.get(key);
  if (cached && cached > now) return cooldown(cached, now);
  denied.delete(key);
  const start = Math.floor(now / windowMs) * windowMs;
  const id = `${key}:${start}`;
  const expiresAt = new Date(start + windowMs);
  let count: number;
  if (dbConfigured()) {
    const c = (await db()).collection<LimitDoc>('rateLimits');
    if (!consume) count = (await c.findOne({ _id: id }))?.count ?? 0;
    else {
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
      let row;
      try { row = await c.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: 'after' }); }
      catch (e) {
        if (!duplicate(e)) throw e;
        row = await c.findOneAndUpdate({ _id: id }, update, { returnDocument: 'after' });
      }
      count = row!.count;
    }
  } else {
    for (const [k, v] of memory) if (v.expiresAt.getTime() <= now) memory.delete(k);
    const row = memory.get(id) ?? { _id: id, count: 0, expiresAt };
    if (consume) { row.count++; if (memory.size >= 5000) memory.delete(memory.keys().next().value!); memory.set(id, row); }
    count = row.count;
  }
  if (consume ? count > max : count >= max) {
    if (denied.size >= 5000) denied.delete(denied.keys().next().value!);
    denied.set(key, expiresAt.getTime());
    return cooldown(expiresAt.getTime(), now);
  }
  return null;
}
