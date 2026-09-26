import { createHash } from 'node:crypto';
import type { ClientSession, Db } from 'mongodb';
import type { InstrumentId } from '@/lib/content';
import type { Exercise } from '@/lib/music';
import type { NoteResult } from '@/lib/mic';
import { emptyWeaknesses, mergePerformance } from '@/lib/training-core';
import type { PerformanceSource, WeaknessSummary } from '@/lib/training-types';

export interface PracticeProfileDoc { _id: string; summary: WeaknessSummary; updatedAt: Date }
interface PerformanceEventDoc { _id: string; userId: string; source: PerformanceSource; attemptId: string; digest: string; instrument: InstrumentId; total: number; hits: number; simulated: boolean; at: Date }
export class PerformanceConflict extends Error {}
export const performanceDigest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readWeaknesses(d: Db, userId: string, session?: ClientSession) {
  return (await d.collection<PracticeProfileDoc>('practiceProfiles').findOne({ _id: userId }, { session }))?.summary ?? emptyWeaknesses();
}
/** Call inside the caller's transaction, including the first accepted tavern result. */
export async function recordPerformance(d: Db, session: ClientSession, userId: string, source: PerformanceSource, attemptId: string, instrument: InstrumentId, exercise: Exercise, notes: NoteResult[], simulated = false): Promise<WeaknessSummary> {
  const key = performanceDigest([userId, source, attemptId]);
  const digest = performanceDigest({ instrument, exercise, notes, simulated });
  const events = d.collection<PerformanceEventDoc>('performanceEvents');
  const previous = await events.findOne({ _id: key }, { session });
  const summary = await readWeaknesses(d, userId, session);
  if (previous) { if (previous.digest !== digest) throw new PerformanceConflict('This performance was already recorded with different results.'); return summary; }
  await events.insertOne({ _id: key, userId, source, attemptId, digest, instrument, total: notes.length, hits: notes.filter(n => n.status === 'hit').length, simulated, at: new Date() }, { session });
  const merged = mergePerformance(summary, exercise, notes, source, simulated);
  if (!simulated) await d.collection<PracticeProfileDoc>('practiceProfiles').updateOne({ _id: userId }, { $set: { summary: merged, updatedAt: new Date() } }, { upsert: true, session });
  return merged;
}
