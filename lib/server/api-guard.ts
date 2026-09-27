import { createHash } from 'node:crypto';
import { handled } from './http';
import { clientIp, limit } from './ratelimit';

/** A shared MongoDB budget covers every API route, including invalid requests.
 * Network budgets allow a classroom behind one router; session budgets stop
 * individual clients polling or submitting faster than the game requires. */
export function guarded(request: Request, work: () => Promise<Response>) {
  return handled(async () => {
    const path = new URL(request.url).pathname;
    const family = path.split('/')[2] || 'unknown';
    const ip = clientIp(request);
    const network = await limit(`api:network:${ip}`, 3000, 60_000);
    if (network) return network;
    const token = request.headers.get('authorization') || request.headers.get('cookie')?.match(/(?:^|;\s*)stc_session=([^;]+)/)?.[1];
    const identity = token ? createHash('sha256').update(token.slice(0,512)).digest('hex') : `ip:${ip}`;
    const max = family === 'auth' ? 120 : family === 'leaderboard' && path.endsWith('/live') ? 30 : token ? 240 : 900;
    const blocked = await limit(`api:${family}:${identity}`, max, 60_000);
    if (blocked) return blocked;
    const response = await work();
    response.headers.set('X-Content-Type-Options', 'nosniff');
    if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control','private, no-store');
    return response;
  });
}

/** Cost ceiling shared by taunts and both mentors across all server instances. */
export async function voiceBudget(request: Request) {
  return await limit(`voice:ip:${clientIp(request)}`, 40, 600_000)
    ?? await limit('voice:global:minute', 20, 60_000)
    ?? await limit('voice:global:day', 250, 86_400_000);
}
