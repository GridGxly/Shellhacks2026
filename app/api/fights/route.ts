import { currentUser, db, dbConfigured, offline } from '@/lib/db';
import { ENEMIES } from '@/lib/content';
import { bad, handled, int, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { instrument } from '@/lib/server/validation';

// Every fight's outcome, guests included, so each foe's real danger is known (PRD §7b).
interface FightDoc {
  enemyId: string;
  won: boolean;
  accuracy: number;
  rounds: number;
  instrument: string;
  userId: string | null;
  at: Date;
}

export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 2048); if (b instanceof Response) return b;
    if (b.demo === true) return new Response(null, { status: 204 });
    if (typeof b.enemyId !== 'string' || !ENEMIES.some((e) => e.id === b.enemyId) || typeof b.won !== 'boolean' || !int(b.accuracy, 0, 100) || !int(b.rounds, 1, 50) || !instrument(b.instrument) || (b.demo !== undefined && typeof b.demo !== 'boolean')) return bad('Bad fight.');
    const limited = await limit(`fights:${clientIp(request)}`, 60, 600_000); if (limited) return limited;
    if (!dbConfigured()) return offline();
    const u = await currentUser();
    await (await db()).collection<FightDoc>('fights').insertOne({ enemyId: b.enemyId, won: b.won, accuracy: b.accuracy, rounds: b.rounds, instrument: b.instrument, userId: u?._id ?? null, at: new Date() });
    return Response.json({ ok: true });
  });
}

/** Per-enemy danger: attempts, how many climbers fell, average accuracy. */
export async function GET() {
  return handled(async () => {
    if (!dbConfigured()) return offline();
    const rows = await (await db())
      .collection<FightDoc>('fights')
      .aggregate<{ _id: string; attempts: number; losses: number; accuracy: number; rounds: number }>([
        { $group: { _id: '$enemyId', attempts: { $sum: 1 }, losses: { $sum: { $cond: ['$won', 0, 1] } }, accuracy: { $avg: '$accuracy' }, rounds: { $avg: '$rounds' } } },
      ])
      .toArray();
    const stats = Object.fromEntries(rows.map((r) => [r._id, { attempts: r.attempts, fellRate: Math.round((r.losses / r.attempts) * 100), accuracy: Math.round(r.accuracy), rounds: Math.round(r.rounds * 10) / 10 }]));
    return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=30' } });
  });
}
