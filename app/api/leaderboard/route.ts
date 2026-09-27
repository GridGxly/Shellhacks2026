import { guarded } from '@/lib/server/api-guard';
import { currentUser, dbConfigured, offline } from '@/lib/db';
import { leaderboard, playerRank, rankRow, weekKey } from '@/lib/server/ranking';

export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const match = new URL(request.url).searchParams.get('range') === 'week' ? { weekKey: weekKey() } : {};
    const u = await currentUser();
    const [best, mine] = await Promise.all([leaderboard(match), u ? playerRank(u._id, match) : null]);
    return Response.json({ rows: best.map((r, i) => rankRow(r, i + 1)), me: mine ? rankRow(mine.best, mine.rank) : null });
  });
}
