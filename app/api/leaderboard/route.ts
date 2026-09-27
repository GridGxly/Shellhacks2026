import { guarded } from '@/lib/server/api-guard';
import { dbConfigured, offline } from '@/lib/db';
import { leaderboard, rankRow, scopeOf } from '@/lib/server/ranking';

/** The public board: identical for every viewer, so it reads no cookies and the CDN may serve it for a few seconds. */
export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const rows = await leaderboard(scopeOf(new URL(request.url).searchParams.get('range')));
    return Response.json({ rows: rows.map((r, i) => rankRow(r, i + 1)) }, { headers: { 'Cache-Control': 'public, max-age=5, s-maxage=10, stale-while-revalidate=30' } });
  });
}
