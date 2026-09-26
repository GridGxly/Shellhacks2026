import { endSession } from '@/lib/db';

export async function POST() {
  await endSession();
  return Response.json({ ok: true });
}
