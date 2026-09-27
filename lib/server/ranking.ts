import { LEADERBOARD_SIZE } from '@/lib/config';
import { db, type RunDoc, type UserDoc, publicUser } from '@/lib/db';
import type { ClientSession, Db } from 'mongodb';
import { weekKey } from '../week';

export { weekKey };

/**
 * Leaderboards read `bests`: one document per player for all time (scope
 * "all") and one per player per ISO week (scope = weekKey), kept current by
 * recordBest() inside the /api/runs transaction. Boards and ranks are then
 * index reads instead of sorting and grouping every run ever posted.
 */
export interface BestDoc {
  _id: string; // `${scope}:${userId}`
  scope: string; // 'all' | weekKey
  userId: string;
  username: string;
  runId: string;
  score: number;
  floor: number;
  instrument: string;
  accuracy: number;
  at: Date;
}
export const bests = (d: Db) => d.collection<BestDoc>('bests');
export const scopeOf = (range: string | null) => (range === 'week' ? weekKey() : 'all');
// userId breaks exact score/date ties consistently (matches the bests index).
const sort = { score: -1, at: 1, userId: 1 } as const;

export const rankRow = (r: Pick<BestDoc, 'username' | 'score' | 'floor' | 'instrument' | 'accuracy' | 'at'>, rank: number) => ({ rank, username: r.username, score: r.score, floor: r.floor, instrument: r.instrument, accuracy: r.accuracy, at: r.at });

/** Call inside the run's transaction. A later run replaces a best only by scoring strictly higher (earlier wins ties). */
export async function recordBest(d: Db, session: ClientSession, run: RunDoc) {
  for (const scope of ['all', run.weekKey]) {
    const _id = `${scope}:${run.userId}`;
    const current = await bests(d).findOne({ _id }, { session, projection: { score: 1 } });
    if (current && current.score >= run.score) continue;
    const doc: BestDoc = { _id, scope, userId: run.userId, username: run.username, runId: run.runId, score: run.score, floor: run.floor, instrument: run.instrument, accuracy: run.accuracy, at: run.at };
    await bests(d).replaceOne({ _id }, doc, { upsert: true, session });
  }
}

export async function playerRank(userId: string, scope = 'all') {
  const col = bests(await db());
  const best = await col.findOne({ _id: `${scope}:${userId}` });
  if (!best) return null;
  const ahead = await col.countDocuments({ scope, $or: [
    { score: { $gt: best.score } },
    { score: best.score, at: { $lt: best.at } },
    { score: best.score, at: best.at, userId: { $lt: userId } },
  ] });
  return { best, rank: ahead + 1 };
}

export async function leaderboard(scope: string) {
  return bests(await db()).find({ scope }).sort(sort).limit(LEADERBOARD_SIZE).toArray();
}

export async function profile(u: UserDoc) {
  const runs = (await db()).collection<RunDoc>('runs');
  const [recent, totals, ranked, favorite] = await Promise.all([
    runs.find({ userId: u._id }).sort({ at: -1, _id: 1 }).limit(10).toArray(),
    runs.aggregate<{ runs: number; wins: number; notesHit: number; notesTotal: number; encores: number; deepest: number }>([
      { $match: { userId: u._id } },
      { $group: { _id: null, runs: { $sum: 1 }, wins: { $sum: { $cond: [{ $eq: ['$endedBy', 'victory'] }, 1, 0] } }, notesHit: { $sum: '$notesHit' }, notesTotal: { $sum: '$notesTotal' }, encores: { $sum: { $ifNull: ['$encoresLanded', '$encores'] } }, deepest: { $max: '$floor' } } },
      { $project: { _id: 0 } },
    ]).next(),
    playerRank(u._id),
    runs.aggregate<{ _id: string }>([
      { $match: { userId: u._id } }, { $group: { _id: '$instrument', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }, { $limit: 1 },
    ]).next(),
  ]);
  return {
    ...publicUser(u), createdAt: u.createdAt, rank: ranked?.rank ?? null,
    favoriteInstrument: favorite?._id ?? null,
    best: ranked ? { score: ranked.best.score, floor: ranked.best.floor } : null,
    totals: totals ?? { runs: 0, wins: 0, notesHit: 0, notesTotal: 0, encores: 0, deepest: 0 },
    deepest: totals?.deepest ?? 0,
    runs: recent.map((r) => ({ score: r.score, floor: r.floor, instrument: r.instrument, endedBy: r.endedBy, at: r.at })),
  };
}
