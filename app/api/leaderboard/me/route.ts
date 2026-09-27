import { guarded } from '@/lib/server/api-guard';
import { currentUser, dbConfigured, offline } from '@/lib/db';
import { playerRank, rankRow, scopeOf } from '@/lib/server/ranking';

/** The signed-in player's own row and rank (private; the shared board is /api/leaderboard). */
export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const u = await currentUser();
    const mine = u ? await playerRank(u._id, scopeOf(new URL(request.url).searchParams.get('range'))) : null;
    return Response.json({ me: mine ? rankRow(mine.best, mine.rank) : null });
  });
}
