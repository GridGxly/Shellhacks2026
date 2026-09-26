import { currentUser, db, dbConfigured, offline, unauthorized, type RunDoc, type UserDoc } from '@/lib/db';

interface RunIn {
  run: {
    instrument: string;
    floor: number;
    score: number;
    hp: number;
    xp: number;
    stats: { notesHit: number; notesTotal: number; cardsLanded: number; encoresLanded: number };
  };
  endedBy: 'loss' | 'victory';
}

/** Upper bound on a legit score for this run (PRD §7b: the server doesn't trust the client total). */
function maxScore(r: RunIn['run']) {
  let s = 0;
  for (let f = 1; f <= r.floor; f++) s += 1000 * f + 25 * 32 + (f % 3 === 0 ? 2500 : 0);
  return s + 300 * r.stats.cardsLanded + 1500 * r.stats.encoresLanded;
}

export async function POST(request: Request) {
  if (!dbConfigured()) return offline();
  const u = await currentUser();
  if (!u) return unauthorized();
  const { run, endedBy } = (await request.json()) as RunIn;
  if (!run || typeof run.score !== 'number' || run.floor < 0 || run.floor > 18) return Response.json({ error: 'Bad run.' }, { status: 400 });
  const score = Math.max(0, Math.min(Math.round(run.score), maxScore(run)));
  const d = await db();
  const doc: RunDoc = {
    userId: u._id,
    username: u.username,
    score,
    floor: run.floor,
    instrument: String(run.instrument).slice(0, 20),
    accuracy: run.stats.notesTotal ? Math.round((run.stats.notesHit / run.stats.notesTotal) * 100) : 0,
    notesHit: run.stats.notesHit,
    notesTotal: run.stats.notesTotal,
    encores: run.stats.encoresLanded,
    endedBy: endedBy === 'victory' ? 'victory' : 'loss',
    at: new Date(),
  };
  await d.collection<RunDoc>('runs').insertOne(doc);
  await d.collection<UserDoc>('users').updateOne({ _id: u._id }, { $inc: { xp: Math.max(0, Math.min(2000, run.xp | 0)) } });
  return Response.json({ ok: true, score });
}
