import { currentUser, dbConfigured, offline, unauthorized } from '@/lib/db';
import { handled } from '@/lib/server/http';
import { profile } from '@/lib/server/ranking';

export async function GET() {
  return handled(async () => {
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    return Response.json(await profile(u));
  });
}
