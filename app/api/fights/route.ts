import { currentUser, db, dbConfigured, offline } from '@/lib/db';
import { ENEMIES } from '@/lib/content';

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
  if (!dbConfigured()) return offline();
  const b = (await request.json().catch(() => null)) as Partial<FightDoc> | null;
  if (!b || !ENEMIES.some((e) => e.id === b.enemyId)) return Response.json({ error: 'Bad fight.' }, { status: 400 });
  const u = await currentUser().catch(() => null);
  await (await db()).collection<FightDoc>('fights').insertOne({
    enemyId: b.enemyId!,
    won: !!b.won,
    accuracy: Math.max(0, Math.min(100, Math.round(Number(b.accuracy) || 0))),
    rounds: Math.max(1, Math.min(50, Number(b.rounds) || 1)),
    instrument: String(b.instrument ?? '').slice(0, 20),
    userId: u?._id ?? null,
    at: new Date(),
  });
  return Response.json({ ok: true });
}

/** Per-enemy danger: attempts, how many climbers fell, average accuracy. */
export async function GET() {
  if (!dbConfigured()) return offline();
  const rows = await (await db())
    .collection<FightDoc>('fights')
    .aggregate<{ _id: string; attempts: number; losses: number; accuracy: number; rounds: number }>([
      { $group: { _id: '$enemyId', attempts: { $sum: 1 }, losses: { $sum: { $cond: ['$won', 0, 1] } }, accuracy: { $avg: '$accuracy' }, rounds: { $avg: '$rounds' } } },
    ])
    .toArray();
  const stats = Object.fromEntries(rows.map((r) => [r._id, { attempts: r.attempts, fellRate: Math.round((r.losses / r.attempts) * 100), accuracy: Math.round(r.accuracy), rounds: Math.round(r.rounds * 10) / 10 }]));
  return Response.json(stats, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
