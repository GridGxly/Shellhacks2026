import type { CreateIndexesOptions, Db, Document, IndexSpecification } from 'mongodb';
import manifest from '../mongo-indexes.json';
import { sha256Hex } from './hash';

// Static manifest from the repo; JSON typing can't express IndexSpecification directly.
const INDEXES = manifest as unknown as { collection: string; keys: IndexSpecification; options?: CreateIndexesOptions }[];
// Bump the suffix when a one-time data step (like the bests backfill) changes.
const VERSION = `${sha256Hex(JSON.stringify(manifest)).slice(0, 16)}:bests-1`;

const bestFields = (scope: unknown): Document => ({
  scope, userId: '$doc.userId', username: '$doc.username', runId: '$doc.runId', score: '$doc.score',
  floor: '$doc.floor', instrument: '$doc.instrument', accuracy: '$doc.accuracy', at: '$doc.at',
});
// Keep whichever best is higher, so a backfill never undoes a newer record.
const keepHigher = { into: 'bests', on: '_id', whenMatched: [{ $replaceWith: { $cond: [{ $gt: ['$$new.score', '$score'] }, '$$new', '$$ROOT'] } }], whenNotMatched: 'insert' };

/** Rebuild `bests` (see lib/server/ranking.ts) from every posted run: all-time and per week. */
async function backfillBests(d: Db) {
  const runs = d.collection('runs');
  const best = [{ $sort: { score: -1, at: 1 } }];
  await runs.aggregate([
    ...best, { $group: { _id: '$userId', doc: { $first: '$$ROOT' } } },
    { $project: { _id: { $concat: ['all:', '$_id'] }, ...bestFields({ $literal: 'all' }) } },
    { $merge: keepHigher },
  ], { allowDiskUse: true }).toArray();
  await runs.aggregate([
    ...best, { $group: { _id: { user: '$userId', week: '$weekKey' }, doc: { $first: '$$ROOT' } } },
    { $project: { _id: { $concat: ['$_id.week', ':', '$_id.user'] }, ...bestFields('$_id.week') } },
    { $merge: keepHigher },
  ], { allowDiskUse: true }).toArray();
}

/**
 * Indexes and one-time data steps, run only when lib/mongo-indexes.json (or
 * VERSION) changes. A cold start costs one read instead of re-sending every
 * createIndex. scripts/atlas-setup.mjs applies the same manifest.
 */
export async function ensureSchema(d: Db) {
  const meta = d.collection<{ _id: string; version: string; at: Date }>('meta');
  if ((await meta.findOne({ _id: 'schema' }))?.version === VERSION) return;
  await Promise.all(INDEXES.map((ix) => d.collection(ix.collection).createIndex(ix.keys, ix.options)));
  await backfillBests(d);
  await meta.updateOne({ _id: 'schema' }, { $set: { version: VERSION, at: new Date() } }, { upsert: true });
}
