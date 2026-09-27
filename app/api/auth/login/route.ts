import { guarded } from '@/lib/server/api-guard';
import { createSession, db, dbConfigured, offline, publicUser, type UserDoc } from '@/lib/db';
import { bad, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { verifyPassword, hashPassword } from '@/lib/server/password';
import { liveSave } from '@/lib/server/saves';
import { credentials } from '@/lib/server/validation';

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 2048); if (b instanceof Response) return b;
    // Sign-in accepts accounts made under the older 6-character rule; the 8+ policy applies at signup.
    if (!credentials(b.username, b.password, 1)) return bad('Wrong username or password.', 401);
    if (!dbConfigured()) return offline();
    // Spend a per-IP allowance before hashing, so parallel guesses can't all pass the account check below.
    const perIp = await limit(`login-ip:${clientIp(request)}`, 30, 600_000); if (perIp) return perIp;
    const key = `login:${b.username.toLowerCase()}`;
    const blocked = await limit(key, 5, 600_000, false); if (blocked) return blocked;
    const d = await db();
    const user = await d.collection<UserDoc>('users').findOne({ _id: b.username.toLowerCase() });
    const { ok, rehash } = await verifyPassword(b.password as string, user?.passwordHash);
    if (!user || !ok) {
      const limited = await limit(key, 5, 600_000); if (limited) return limited;
      return bad('Wrong username or password.', 401);
    }
    // A concurrent failed attempt may have filled the window while hashing ran.
    const limited = await limit(key, 5, 600_000, false); if (limited) return limited;
    // Legacy bcrypt accounts move to scrypt on their first successful sign-in.
    if (rehash) await d.collection<UserDoc>('users').updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(b.password as string) } });
    await createSession(user._id);
    return Response.json({ user: publicUser(user), save: await liveSave(d, user._id) });
  });
}
