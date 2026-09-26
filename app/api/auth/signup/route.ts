import bcrypt from 'bcryptjs';
import { createSession, db, dbConfigured, offline, publicUser, type UserDoc } from '@/lib/db';

export async function POST(request: Request) {
  if (!dbConfigured()) return offline();
  const { username, password } = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) return Response.json({ error: 'Usernames are 3–16 letters, numbers or _.' }, { status: 400 });
  if (!password || password.length < 6 || password.length > 128) return Response.json({ error: 'Passwords need at least 6 characters.' }, { status: 400 });
  const d = await db();
  const user: UserDoc = { _id: username.toLowerCase(), username, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date(), xp: 0 };
  try {
    await d.collection<UserDoc>('users').insertOne(user);
  } catch {
    return Response.json({ error: 'That name is taken. Try another.' }, { status: 409 });
  }
  await createSession(user._id);
  return Response.json({ user: publicUser(user), save: null });
}
