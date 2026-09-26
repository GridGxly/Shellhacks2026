import { db, type RunDoc, type UserDoc, publicUser } from '@/lib/db';
import type { Document } from 'mongodb';

export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// userId breaks exact score/date ties consistently; _id chooses identical runs.
const sort = { score: -1, at: 1, userId: 1, _id: 1 } as const;
const bestPipeline = (match: Document): Document[] => [
  { $match: match }, { $sort: sort },
  { $group: { _id: '$userId', doc: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$doc' } },
];
export const rankRow = (r: RunDoc, rank: number) => ({ rank, username: r.username, score: r.score, floor: r.floor, instrument: r.instrument, accuracy: r.accuracy, at: r.at });

export async function playerRank(userId: string, match: Document = {}) {
  const runs = (await db()).collection<RunDoc>('runs');
  const best = await runs.findOne({ ...match, userId }, { sort });
  if (!best) return null;
  const count = await runs.aggregate<{ count: number }>([
    ...bestPipeline(match),
    { $match: { $or: [
      { score: { $gt: best.score } },
      { score: best.score, at: { $lt: best.at } },
      { score: best.score, at: best.at, userId: { $lt: userId } },
    ] } },
    { $count: 'count' },
  ]).next();
  return { best, rank: (count?.count ?? 0) + 1 };
}

export async function leaderboard(match: Document) {
  return (await db()).collection<RunDoc>('runs').aggregate<RunDoc>([
    ...bestPipeline(match), { $sort: sort }, { $limit: 50 },
  ]).toArray();
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
