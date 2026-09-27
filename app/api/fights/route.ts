import { guarded } from '@/lib/server/api-guard';
import { db, dbConfigured, offline } from '@/lib/db';
import { ENEMIES } from '@/lib/content';
import { bad, int, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { instrument } from '@/lib/server/validation';

// Every fight's outcome, guests included, so each foe's real danger is known (PRD §7b).
// Kept as running totals, one document per enemy: the bestiary reads 18 small
// documents instead of aggregating every fight ever played.
interface FightStatsDoc {
  _id: string; // enemy id
  attempts: number;
  losses: number;
  accuracySum: number;
  roundsSum: number;
  updatedAt: Date;
}

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 2048); if (b instanceof Response) return b;
    if (b.demo === true) return new Response(null, { status: 204 });
    if (typeof b.enemyId !== 'string' || !ENEMIES.some((e) => e.id === b.enemyId) || typeof b.won !== 'boolean' || !int(b.accuracy, 0, 100) || !int(b.rounds, 1, 50) || !instrument(b.instrument) || (b.demo !== undefined && typeof b.demo !== 'boolean')) return bad('Bad fight.');
    const limited = await limit(`fights:${clientIp(request)}`, 60, 600_000); if (limited) return limited;
    if (!dbConfigured()) return offline();
    await (await db()).collection<FightStatsDoc>('fightStats').updateOne(
      { _id: b.enemyId },
      { $inc: { attempts: 1, losses: b.won ? 0 : 1, accuracySum: b.accuracy, roundsSum: b.rounds }, $set: { updatedAt: new Date() } },
      { upsert: true },
    );
    return Response.json({ ok: true });
  });
}

/** Per-enemy danger: attempts, how many climbers fell, average accuracy. */
export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const rows = await (await db()).collection<FightStatsDoc>('fightStats').find({ attempts: { $gt: 0 } }).toArray();
    const stats = Object.fromEntries(rows.map((r) => [r._id, { attempts: r.attempts, fellRate: Math.round((r.losses / r.attempts) * 100), accuracy: Math.round(r.accuracySum / r.attempts), rounds: Math.round((r.roundsSum / r.attempts) * 10) / 10 }]));
    // The same for everyone and slow-moving: let the CDN answer most requests.
    return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } });
  });
}
