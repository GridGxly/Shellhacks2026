import { endSession } from '@/lib/db';
import { handled, mutation } from '@/lib/server/http';

export async function POST(request: Request) {
  const guard = mutation(request, false); if (guard) return guard;
  return handled(async () => {
    await endSession();
    return Response.json({ ok: true });
  });
}
