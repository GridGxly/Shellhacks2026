import { guarded } from '@/lib/server/api-guard';
import { mutation, object, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { currentUser } from '@/lib/db';
import { clampChatHistory, clampLabSettings } from '@/lib/lab';
import { chatLab } from '@/lib/server/lab';
import { voiceTicket } from '@/lib/server/training-provider';

export async function POST(request: Request) {
  return guarded(request, async () => {
    const guard = mutation(request); if (guard) return guard;
    const body = await readJson(request, 16 * 1024); if (body instanceof Response) return body;
    const user = await currentUser();
    const blocked = await limit(`training-lab-chat:${user?._id ?? clientIp(request)}`, 20, 600000); if (blocked) return blocked;
    const global = await limit('training-lab-chat:global', 80, 60000); if (global) return global;
    const history = clampChatHistory(body.history);
    const current = clampLabSettings(object(body.current) ? body.current : {});
    const result = await chatLab(history, current);
    const voiceTokens = {
      castor: voiceTicket({ source: 'offline', castor: result.replies.find(r => r.speaker === 'castor')?.line ?? '', pollux: '' }),
      pollux: voiceTicket({ source: 'offline', castor: '', pollux: result.replies.find(r => r.speaker === 'pollux')?.line ?? '' }),
    };
    return Response.json({ ...result, voiceTokens }, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
