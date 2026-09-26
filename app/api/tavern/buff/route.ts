import { currentUser, db, dbConfigured, offline, unauthorized, type UserDoc } from '@/lib/db';
import { handled, mutation } from '@/lib/server/http';

export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request, false); if (guard) return guard;
    if (!dbConfigured()) return offline();
    const user = await currentUser(); if (!user) return unauthorized();
    // Only one tab can consume the pending boolean, even across server instances.
    const claimed = await (await db()).collection<UserDoc>('users').findOneAndUpdate(
      { _id: user._id, tavernBuff: true }, { $unset: { tavernBuff: '' } },
      { returnDocument: 'before', projection: { tavernBuff: 1 } },
    );
    return Response.json({ claimed: !!claimed, serverNow: Date.now() }, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
