import { guarded } from '@/lib/server/api-guard';
import { currentUser, db, dbConfigured, offline, unauthorized } from '@/lib/db';
import { bad, mutation, readJson } from '@/lib/server/http';
import { climbEnded, liveSave, saves } from '@/lib/server/saves';
import { saveRun } from '@/lib/server/validation';

export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    return Response.json({ run: await liveSave(await db(), u._id) });
  });
}

export async function PUT(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const b = await readJson(request, 32 * 1024); if (b instanceof Response) return b;
    const run = saveRun(b.run); if (!run) return bad('Bad save.');
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    const d = await db();
    if (await climbEnded(d, u._id, run.id)) return bad('That climb has already ended.', 409);
    await saves(d).updateOne({ _id: u._id }, { $set: { version: 1, run, updatedAt: new Date() } }, { upsert: true });
    return Response.json({ ok: true });
  });
}

export async function DELETE(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request, false); if (guard) return guard;
    if (!dbConfigured()) return offline();
    const u = await currentUser(); if (!u) return unauthorized();
    await saves(await db()).deleteOne({ _id: u._id });
    return Response.json({ ok: true });
  });
}
