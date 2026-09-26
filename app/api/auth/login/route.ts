import { guarded } from '@/lib/server/api-guard';
import bcrypt from 'bcryptjs';
import { createSession, db, dbConfigured, offline, publicUser, type UserDoc } from '@/lib/db';
import { bad, mutation, readJson } from '@/lib/server/http';
import { limit } from '@/lib/server/ratelimit';
import { credentials } from '@/lib/server/validation';

const DUMMY = '$2b$12$.fQAPdB0RHiRCYe81H3iiOCLTszHpZtgpM91MAkYK2DP/Yls5Bq4e';
export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 2048); if (b instanceof Response) return b;
    // Sign-in accepts accounts made under the older 6-character rule; the 8+ policy applies at signup.
    if (!credentials(b.username, b.password, 1)) return bad('Wrong username or password.', 401);
    if (!dbConfigured()) return offline();
    const key = `login:${b.username.toLowerCase()}`;
    const blocked = await limit(key, 5, 600_000, false); if (blocked) return blocked;
    const d = await db();
    const user = await d.collection<UserDoc>('users').findOne({ _id: b.username.toLowerCase() });
    const matches = await bcrypt.compare(b.password as string, user?.passwordHash ?? DUMMY);
    if (!user || !matches) {
      const limited = await limit(key, 5, 600_000); if (limited) return limited;
      return bad('Wrong username or password.', 401);
    }
    // A concurrent failed attempt may have filled the window while bcrypt ran.
    const limited = await limit(key, 5, 600_000, false); if (limited) return limited;
    await createSession(user._id);
    const save = await d.collection<{ _id: string; run: unknown }>('saves').findOne({ _id: user._id });
    return Response.json({ user: publicUser(user), save: save?.run ?? null });
  });
}
