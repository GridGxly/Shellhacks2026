import { currentUser, db, dbConfigured, offline, type RunDoc } from '@/lib/db';

// Best run per player, highest first.
export async function GET(request: Request) {
  if (!dbConfigured()) return offline();
  const range = new URL(request.url).searchParams.get('range') === 'week' ? 'week' : 'all';
  const d = await db();
  const match = range === 'week' ? { at: { $gte: new Date(Date.now() - 7 * 86400_000) } } : {};
  const best = await d
    .collection<RunDoc>('runs')
    .aggregate<RunDoc>([
      { $match: match },
      { $sort: { score: -1, at: 1 } },
      { $group: { _id: '$userId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { score: -1, at: 1 } },
      { $limit: 200 },
    ])
    .toArray();
  const rows = best.map((r, i) => ({ rank: i + 1, username: r.username, score: r.score, floor: r.floor, instrument: r.instrument, accuracy: r.accuracy, at: r.at }));
  const u = await currentUser().catch(() => null);
  const me = u ? rows.find((r) => r.username === u.username) ?? null : null;
  return Response.json({ rows: rows.slice(0, 50), me });
}
