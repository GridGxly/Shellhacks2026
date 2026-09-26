import { currentUser, db, dbConfigured, offline, unauthorized } from '@/lib/db';

type SaveDoc = { _id: string; run: unknown; updatedAt: Date };

export async function GET() {
  if (!dbConfigured()) return offline();
  const u = await currentUser();
  if (!u) return unauthorized();
  const s = await (await db()).collection<SaveDoc>('saves').findOne({ _id: u._id });
  return Response.json({ run: s?.run ?? null });
}

export async function PUT(request: Request) {
  if (!dbConfigured()) return offline();
  const u = await currentUser();
  if (!u) return unauthorized();
  const { run } = (await request.json()) as { run: unknown };
  if (!run || typeof run !== 'object' || JSON.stringify(run).length > 8000) return Response.json({ error: 'Bad save.' }, { status: 400 });
  await (await db()).collection<SaveDoc>('saves').updateOne({ _id: u._id }, { $set: { run, updatedAt: new Date() } }, { upsert: true });
  return Response.json({ ok: true });
}

export async function DELETE() {
  if (!dbConfigured()) return offline();
  const u = await currentUser();
  if (!u) return unauthorized();
  await (await db()).collection<SaveDoc>('saves').deleteOne({ _id: u._id });
  return Response.json({ ok: true });
}
