import type { Db } from 'mongodb';
import { MENTOR_HISTORY_DAYS, MENTOR_RECENT_CLIMBS, MENTOR_RECENT_DAYS } from '@/lib/config';
import type { InstrumentId } from '@/lib/content';
import type { RunDoc, UserDoc } from '@/lib/db';
import { utcDay } from '@/lib/training-core';
import type { MentorProfile, PerformanceSource, SourceStats } from '@/lib/training-types';
import { readWeaknesses } from './performance';
import type { TrainingDailyDoc } from './training';

const DAY = 86400_000;
const emptyStats = (): SourceStats => ({ attempts: 0, hits: 0, notes: 0 });

/** Consecutive completed days, counting back from today (or yesterday, if today isn't done yet). */
function streakOf(completed: Set<string>, now: number) {
  let day = completed.has(utcDay(now)) ? now : now - DAY;
  let streak = 0;
  while (completed.has(utcDay(day))) { streak++; day -= DAY; }
  return streak;
}

/**
 * The mentor's player file for one signed-in player. Each query uses an index
 * from lib/mongo-indexes.json:
 *   practiceProfiles  _id (point read)
 *   performanceEvents { userId: 1, at: -1 }  (last MENTOR_RECENT_DAYS)
 *   runs              { userId: 1, at: -1 }  (recent climbs, and the totals scan below)
 *   runs              { userId: 1, score: -1 } (best)
 *   trainingDaily     { userId: 1, day: 1 }  (last MENTOR_HISTORY_DAYS)
 * The climb totals read all of one player's runs (index-scoped, not bounded);
 * fine at hackathon scale, move to per-user counters if histories grow large.
 */
export async function readMentorProfile(d: Db, user: UserDoc, now = Date.now()): Promise<MentorProfile> {
  const userId = user._id;
  const runs = d.collection<RunDoc>('runs');
  const since = new Date(now - MENTOR_RECENT_DAYS * DAY);
  const historyFrom = utcDay(now - (MENTOR_HISTORY_DAYS - 1) * DAY);

  const [weaknesses, bySource, recentRuns, climbs, best, days] = await Promise.all([
    readWeaknesses(d, userId),
    d.collection('performanceEvents').aggregate<{ _id: PerformanceSource } & SourceStats>([
      { $match: { userId, simulated: false, at: { $gte: since } } },
      { $group: { _id: '$source', attempts: { $sum: 1 }, hits: { $sum: '$hits' }, notes: { $sum: '$total' } } },
    ]).toArray(),
    runs.find({ userId }, { projection: { floor: 1, accuracy: 1, instrument: 1, endedBy: 1, at: 1 } }).sort({ at: -1 }).limit(MENTOR_RECENT_CLIMBS).toArray(),
    // One pass over the player's runs for both totals and favourite instrument.
    runs.aggregate<{ totals: { total: number; victories: number; deepest: number }[]; favorite: { _id: InstrumentId }[] }>([
      { $match: { userId } },
      { $facet: {
        totals: [{ $group: { _id: null, total: { $sum: 1 }, victories: { $sum: { $cond: ['$victory', 1, 0] } }, deepest: { $max: '$floor' } } }],
        favorite: [{ $group: { _id: '$instrument', n: { $sum: 1 } } }, { $sort: { n: -1, _id: 1 } }, { $limit: 1 }],
      } },
    ]).next(),
    runs.findOne({ userId }, { sort: { score: -1 }, projection: { score: 1, floor: 1 } }),
    d.collection<TrainingDailyDoc>('trainingDaily')
      .find({ userId, day: { $gte: historyFrom } }, { projection: { day: 1, completedAt: 1, 'state.status': 1, 'state.claimed': 1, 'state.nextIndex': 1 } })
      .toArray(),
  ]);

  const recent = { adventure: emptyStats(), tavern: emptyStats(), training: emptyStats() } satisfies Record<PerformanceSource, SourceStats>;
  for (const row of bySource) if (row._id in recent) recent[row._id] = { attempts: row.attempts, hits: row.hits, notes: row.notes };

  // completedAt sticks even if the player later ended or replaced the set; status covers rows written before it existed.
  const completed = new Set(days.filter((r) => r.completedAt || r.state.status === 'complete').map((r) => r.day));
  const totals = climbs?.totals[0];
  const favorite = climbs?.favorite[0];
  const todayRow = days.find((r) => r.day === utcDay(now));

  return {
    username: user.username,
    weaknesses,
    recent: { days: MENTOR_RECENT_DAYS, bySource: recent },
    climbs: {
      total: totals?.total ?? 0,
      victories: totals?.victories ?? 0,
      deepest: totals?.deepest ?? 0,
      best: best ? { score: best.score, floor: best.floor } : null,
      favoriteInstrument: favorite?._id ?? null,
      recent: recentRuns.map((r) => ({ floor: r.floor, accuracy: r.accuracy, instrument: r.instrument as InstrumentId, endedBy: r.endedBy, at: r.at.getTime() })),
    },
    training: {
      daysCompleted: completed.size,
      streak: streakOf(completed, now),
      today: todayRow ? { status: todayRow.state.status, claimed: todayRow.state.claimed, exercisesDone: todayRow.state.nextIndex } : null,
    },
    generatedAt: now,
  };
}
