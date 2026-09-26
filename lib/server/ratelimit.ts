import { db, dbConfigured } from '@/lib/db';
import { bad, duplicate } from './http';

interface LimitDoc { _id: string; count: number; expiresAt: Date }
const memory = new Map<string, LimitDoc>();
export const clientIp = (r: Request) => (r.headers.get('x-forwarded-for')?.split(',')[0].trim() || r.headers.get('x-real-ip')?.trim() || 'unknown').slice(0, 128);

// Window is part of the key: TTL deletion need not happen at the boundary.
export async function limit(key: string, max: number, windowMs: number, consume = true) {
  const now = Date.now();
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
    if (consume) { row.count++; memory.set(id, row); }
    count = row.count;
  }
  if (consume ? count > max : count >= max) {
    const response = bad('Too many attempts. Please retry after the cooldown.', 429);
    response.headers.set('Retry-After', String(Math.ceil((expiresAt.getTime() - now) / 1000)));
    return response;
  }
  return null;
}
