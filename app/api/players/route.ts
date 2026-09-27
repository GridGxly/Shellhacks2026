import { guarded } from '@/lib/server/api-guard';
import { db, dbConfigured, offline, type RunDoc, type UserDoc } from '@/lib/db';
import { bad } from '@/lib/server/http';
import type { Document } from 'mongodb';

// Find-a-climber: Atlas Search autocomplete on usernames (index "usernames",
// created by scripts/atlas-setup.mjs), each hit joined to its best run.
const SEARCH_INDEX = 'usernames';

export async function GET(request: Request) {
  return guarded(request, async () => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(q)) return bad('Search by username.', 400);
    if (!dbConfigured()) return offline();
    const users = (await db()).collection<UserDoc>('users');
    const tail: Document[] = [
      { $limit: 8 },
      // Each hit's all-time best is one _id read in `bests` (lib/server/ranking.ts).
      { $lookup: { from: 'bests', let: { key: { $concat: ['all:', '$_id'] } }, as: 'best', pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$key'] } } },
        { $project: { _id: 0, score: 1, floor: 1, instrument: 1 } },
      ] } },
      { $project: { _id: 0, username: 1, xp: 1, best: { $first: '$best' } } },
    ];
    let rows: { username: string; xp: number; best?: Pick<RunDoc, 'score' | 'floor' | 'instrument'> }[];
    try {
      rows = await users.aggregate<(typeof rows)[number]>([
        { $search: { index: SEARCH_INDEX, autocomplete: { query: q, path: 'username', ...(q.length > 3 ? { fuzzy: { maxEdits: 1 } } : {}) } } },
        ...tail,
      ]).toArray();
    } catch {
      // Search index still building (or missing): plain prefix match on the _id index.
      const lower = q.toLowerCase();
      rows = await users.aggregate<(typeof rows)[number]>([
        { $match: { _id: { $gte: lower, $lt: `${lower}￿` } } }, { $sort: { _id: 1 } }, ...tail,
      ]).toArray();
    }
    return Response.json({ players: rows.map((r) => ({ username: r.username, level: 1 + Math.floor((r.xp ?? 0) / 100), best: r.best ?? null })) });
  });
}
