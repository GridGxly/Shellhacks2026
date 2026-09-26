import { currentUser, transaction, type UserDoc } from '@/lib/db';
import type { RewardClaim } from '@/lib/training-types';
import { TRAINING_BUFF_TIPS } from '@/lib/training-core';
import { TAVERN_BUFF_TIPS } from '@/lib/config';
import { performanceDigest } from '@/lib/server/performance';
import { bad, handled, mutation, readJson } from '@/lib/server/http';
import { limit } from '@/lib/server/ratelimit';

interface RewardClaimDoc extends RewardClaim { _id: string; userId: string; createdAt: Date }
export async function POST(request: Request) {
  return handled(async () => {
    const guard = mutation(request); if (guard) return guard;
    const body = await readJson(request, 1024); if (body instanceof Response) return body;
    if (typeof body.runId !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(body.runId)) return bad('Invalid climb identity.');
    const user = await currentUser(); if (!user) return bad('Guests use their in-memory rewards.', 401);
    const blocked = await limit(`reward-claim:${user._id}`, 60, 600000); if (blocked) return blocked;
    const runId = body.runId;
    const claim = await transaction(async (d, session) => {
      const _id = performanceDigest([user._id, runId]);
      const collection = d.collection<RewardClaimDoc>('rewardClaims');
      const previous = await collection.findOne({ _id }, { session });
      if (previous) return previous;
      const account = await d.collection<UserDoc>('users').findOne({ _id: user._id }, { session });
      const tavern = account?.tavernBuff === true, training = account?.trainingBuff === true;
      const receipt: RewardClaimDoc = { _id, userId: user._id, runId, tavern, training, tips: (tavern ? TAVERN_BUFF_TIPS : 0) + (training ? TRAINING_BUFF_TIPS : 0), createdAt: new Date() };
      await collection.insertOne(receipt, { session });
      await d.collection<UserDoc>('users').updateOne({ _id: user._id }, { $unset: { tavernBuff: '', trainingBuff: '' } }, { session });
      return receipt;
    });
    return Response.json({ runId: claim.runId, tavern: claim.tavern, training: claim.training, tips: claim.tips }, { headers: { 'Cache-Control': 'private, no-store' } });
  });
}
