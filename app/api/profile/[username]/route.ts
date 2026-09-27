import { guarded } from '@/lib/server/api-guard';
import { db, dbConfigured, offline, type UserDoc } from '@/lib/db';
import { bad } from '@/lib/server/http';
import { profile } from '@/lib/server/ranking';

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  return guarded(request, async () => {
    const { username } = await params;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) return bad('Player not found.', 404);
    if (!dbConfigured()) return offline();
    const u = await (await db()).collection<UserDoc>('users').findOne({ _id: username.toLowerCase() });
    return u ? Response.json(await profile(u)) : bad('Player not found.', 404);
  });
}
