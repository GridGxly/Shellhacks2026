import { guarded } from '@/lib/server/api-guard';
import { currentUser, dbConfigured, offline, unauthorized } from '@/lib/db';
import { profile } from '@/lib/server/ranking';

export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    return Response.json(await profile(u));
  });
}
