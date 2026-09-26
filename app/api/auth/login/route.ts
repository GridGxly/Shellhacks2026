import bcrypt from 'bcryptjs';
import { createSession, db, dbConfigured, offline, publicUser, type UserDoc } from '@/lib/db';

export async function POST(request: Request) {
  if (!dbConfigured()) return offline();
  const { username, password } = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return Response.json({ error: 'Enter a username and password.' }, { status: 400 });
  const d = await db();
  const user = await d.collection<UserDoc>('users').findOne({ _id: username.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return Response.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  await createSession(user._id);
  const save = await d.collection<{ _id: string; run: unknown }>('saves').findOne({ _id: user._id });
  return Response.json({ user: publicUser(user), save: save?.run ?? null });
}
