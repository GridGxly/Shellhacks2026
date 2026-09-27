import { guarded } from '@/lib/server/api-guard';
import { createSession, db, dbConfigured, offline, publicUser, type UserDoc } from '@/lib/db';
import { bad, duplicate, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { hashPassword } from '@/lib/server/password';
import { credentials } from '@/lib/server/validation';

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 2048); if (b instanceof Response) return b;
    if (!credentials(b.username, b.password)) return bad('Use a 3–16 character username (letters, numbers, _) and a password of 8+ characters, at most 72 bytes.');
    const limited = await limit(`signup:${clientIp(request)}`, 80, 3600_000); if (limited) return limited;
    if (!dbConfigured()) return offline();
    const d = await db();
    const user: UserDoc = { _id: b.username.toLowerCase(), username: b.username, passwordHash: await hashPassword(b.password as string), createdAt: new Date(), xp: 0 };
    try { await d.collection<UserDoc>('users').insertOne(user); }
    catch (e) { if (duplicate(e)) return bad('That name is taken. Try another.', 409); throw e; }
    await createSession(user._id);
    return Response.json({ user: publicUser(user), save: null });
  });
}
