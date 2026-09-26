import { guarded } from '@/lib/server/api-guard';
import { currentUser, db, dbConfigured, offline, transaction, unauthorized, type RunDoc, type UserDoc } from '@/lib/db';
import { RUN_SUBMIT_COOLDOWN_MS } from '@/lib/config';
import { verifyRun } from '@/lib/score';
import { bad, duplicate, mutation, readJson } from '@/lib/server/http';
import { instrument, runId } from '@/lib/server/validation';
import { weekKey } from '@/lib/server/ranking';

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request); if (b instanceof Response) return b;
    if (b.demo === true) return bad("Practice runs aren't ranked.");
    if (!runId(b.runId) || !instrument(b.instrument) || (b.demo !== undefined && typeof b.demo !== 'boolean') || (b.durationMs !== undefined && (typeof b.durationMs !== 'number' || !Number.isFinite(b.durationMs)))) return bad('Bad run.');
    const verified = verifyRun(b.events, b.endedBy);
    if (typeof verified === 'string') return bad(verified);
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    const filter = { userId: u._id, runId: b.runId };
    const runs = (await db()).collection<RunDoc>('runs');
    const existing = await runs.findOne(filter);
    if (existing) return Response.json({ ok: true, score: existing.score });
    try {
      return await transaction(async (d, session) => {
        const c = d.collection<RunDoc>('runs');
        const existing = await c.findOne(filter, { session });
        if (existing) return Response.json({ ok: true, score: existing.score });
        const previous = await c.findOne({ userId: u._id }, { session, sort: { at: -1 } });
        const at = new Date();
        if (previous && at.getTime() - previous.at.getTime() < RUN_SUBMIT_COOLDOWN_MS) return bad('Please wait before submitting another run.', 429);
        const { xp, ...result } = verified;
        await c.insertOne({ ...filter, username: u.username, instrument: b.instrument as RunDoc['instrument'], ...result, endedBy: b.endedBy as RunDoc['endedBy'], ...(b.durationMs === undefined ? {} : { durationMs: Math.round(Math.max(0, Math.min(86400_000, b.durationMs as number))) }), weekKey: weekKey(at), at }, { session });
        // All submissions write this user, serializing cooldown checks across instances.
        await d.collection<UserDoc>('users').updateOne({ _id: u._id }, { $inc: { xp }, $set: { lastRunAt: at } }, { session });
        await d.collection<{ _id: string }>('saves').deleteOne({ _id: u._id, 'run.id': b.runId }, { session });
        return Response.json({ ok: true, score: verified.score });
      });
    } catch (e) {
      if (duplicate(e)) {
        const stored = await runs.findOne(filter);
        if (stored) return Response.json({ ok: true, score: stored.score });
      }
      throw e;
    }
  });
}
