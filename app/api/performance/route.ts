import { currentUser, transaction } from '@/lib/db';
import { validateExercise, validateTrainingResults } from '@/lib/training-core';
import { instrument } from '@/lib/server/validation';
import { bad, handled, mutation, readJson } from '@/lib/server/http';
import { clientIp, limit } from '@/lib/server/ratelimit';
import { PerformanceConflict, recordPerformance } from '@/lib/server/performance';

export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const body = await readJson(request, 32 * 1024); if (body instanceof Response) return body;
    const user = await currentUser(); if (!user) return bad('Guests keep their practice history in memory.', 401);
    if (body.source !== 'adventure' || typeof body.attemptId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(body.attemptId) || !instrument(body.instrument) || typeof body.simulated !== 'boolean') return bad('Invalid performance.');
    const exercise = validateExercise(body.exercise), notes = exercise ? validateTrainingResults(exercise, body.instrument, body.notes) : null;
    if (!exercise || !notes) return bad('Invalid performance notes.');
    const blocked = await limit(`performance:${user._id}:${clientIp(request)}`, 180, 600000); if (blocked) return blocked;
    try {
      const weaknesses = await transaction((d, session) => recordPerformance(d, session, user._id, 'adventure', body.attemptId as string, body.instrument as Parameters<typeof recordPerformance>[5], exercise, notes, body.simulated as boolean));
      return Response.json({ weaknesses }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) { if (e instanceof PerformanceConflict) return bad(e.message, 409); throw e; }
  });
}
