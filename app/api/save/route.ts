import { currentUser, db, dbConfigured, offline, unauthorized } from '@/lib/db';
import { bad, handled, mutation, readJson } from '@/lib/server/http';
import { saveRun } from '@/lib/server/validation';

type SaveDoc = { _id: string; version: 1; run: NonNullable<ReturnType<typeof saveRun>>; updatedAt: Date };

export async function GET() {
  return handled(async () => {
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    const s = await (await db()).collection<SaveDoc>('saves').findOne({ _id: u._id });
    return Response.json({ run: s?.run ?? null });
  });
}

export async function PUT(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 32 * 1024); if (b instanceof Response) return b;
    const run = saveRun(b.run); if (!run) return bad('Bad save.');
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    await (await db()).collection<SaveDoc>('saves').updateOne({ _id: u._id }, { $set: { version: 1, run, updatedAt: new Date() } }, { upsert: true });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return handled(async () => {
    const guard = mutation(request, false); if (guard) return guard;
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    await (await db()).collection<SaveDoc>('saves').deleteOne({ _id: u._id });
    return Response.json({ ok: true });
  });
}
