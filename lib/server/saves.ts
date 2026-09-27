import type { Db } from 'mongodb';
import type { RunDoc } from '@/lib/db';
import type { saveRun } from './validation';

export type SaveDoc = { _id: string; version: 1; run: NonNullable<ReturnType<typeof saveRun>>; updatedAt: Date };
export const saves = (d: Db) => d.collection<SaveDoc>('saves');

/** A climb that was posted to /api/runs is over (died or won): its checkpoint must never come back. */
export const climbEnded = async (d: Db, userId: string, runId: string) =>
  !!(await d.collection<RunDoc>('runs').findOne({ userId, runId }, { projection: { _id: 1 } }));

/** The player's checkpoint, unless it belongs to a finished climb (a lost DELETE, or a PUT that raced the run post). */
export async function liveSave(d: Db, userId: string) {
  const s = await saves(d).findOne({ _id: userId });
  if (!s) return null;
  if (await climbEnded(d, userId, s.run.id)) {
    await saves(d).deleteOne({ _id: userId, 'run.id': s.run.id });
    return null;
  }
  return s.run;
}
