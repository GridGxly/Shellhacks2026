import { guarded } from '@/lib/server/api-guard';
import { mutation, object, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { currentUser } from '@/lib/db';
import { clampLabSettings } from '@/lib/lab';
import { composeLabPiece } from '@/lib/server/lab';

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const body = await readJson(request, 8 * 1024); if (body instanceof Response) return body;
    const user = await currentUser();
    const blocked = await limit(`training-lab-compose:${user?._id ?? clientIp(request)}`, 8, 600000); if (blocked) return blocked;
    const global = await limit('training-lab-compose:global', 40, 60000); if (global) return global;
    const settings = clampLabSettings(object(body.settings) ? body.settings : body);
    const result = await composeLabPiece(settings);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
