import { currentUser, db, dbConfigured, offline, unauthorized, type RunDoc } from '@/lib/db';

export async function GET() {
  if (!dbConfigured()) return offline();
  const u = await currentUser();
  if (!u) return unauthorized();
  const runs = (await db()).collection<RunDoc>('runs');
  const [recent, totals, bestRun] = await Promise.all([
    runs.find({ userId: u._id }).sort({ at: -1 }).limit(10).toArray(),
    runs
      .aggregate<{ runs: number; wins: number; notesHit: number; notesTotal: number; encores: number; deepest: number }>([
        { $match: { userId: u._id } },
        { $group: { _id: null, runs: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$endedBy', 'victory'] }, 1, 0] } }, notesHit: { $sum: '$notesHit' }, notesTotal: { $sum: '$notesTotal' }, encores: { $sum: '$encores' }, deepest: { $max: '$floor' } } },
      ])
      .next(),
    runs.find({ userId: u._id }).sort({ score: -1 }).limit(1).next(),
  ]);
  const rank = bestRun ? (await runs.distinct('userId', { score: { $gt: bestRun.score } })).length + 1 : null;
  return Response.json({
    username: u.username,
    level: 1 + Math.floor(u.xp / 100),
    createdAt: u.createdAt,
    rank,
    best: bestRun ? { score: bestRun.score, floor: bestRun.floor } : null,
    totals: totals ?? { runs: 0, wins: 0, notesHit: 0, notesTotal: 0, encores: 0 },
    deepest: totals?.deepest ?? 0,
    runs: recent.map((r) => ({ score: r.score, floor: r.floor, instrument: r.instrument, endedBy: r.endedBy, at: r.at })),
  });
}
