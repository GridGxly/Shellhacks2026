import { guarded } from '@/lib/server/api-guard';
import { endSession } from '@/lib/db';
import { mutation } from '@/lib/server/http';

export async function POST(request: Request) {
  const guard = mutation(request, false); if (guard) return guard;
  return guarded(request, async () => {
    await endSession();
    return Response.json({ ok: true });
  });
}
