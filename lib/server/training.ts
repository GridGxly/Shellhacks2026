import { randomUUID } from 'node:crypto';
import type { ClientSession, Db } from 'mongodb';
import { currentUser, db, transaction, type UserDoc } from '@/lib/db';
import { exerciseDurationMs, guestBegin, guestClaim, guestStartPlan, guestSubmit, newGuestTraining, offlineFeedback, utcDay, validateExercise, validatePlan, validateRegiment, validateTrainingResults, validateWeaknesses } from '@/lib/training-core';
import type { InstrumentId } from '@/lib/content';
import type { TrainingResult, TrainingState } from '@/lib/training-types';
import { handled, int, mutation, object, readJson } from './http';
import { clientIp, limit } from './ratelimit';
import { performanceDigest, readWeaknesses, recordPerformance } from './performance';
import { createTrainingFeedback, createTrainingPlan, readVoiceTicket, trainingVoice, voiceTicket } from './training-provider';
import { readMentorProfile } from './mentor';

/** completedAt is set once, when the day's first set is finished, and survives ending/replacing sets (mentor streaks). */
export interface TrainingDailyDoc { _id: string; userId: string; day: string; state: TrainingState; completedAt?: Date; createdAt: Date; updatedAt: Date; expiresAt: Date }
type Action = 'state' | 'profile' | 'plan' | 'begin' | 'result' | 'pause' | 'claim' | 'feedback' | 'voice';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
class Problem extends Error { constructor(message: string, readonly status = 400, readonly code = 'invalid_request') { super(message); } }
const clean = (state: TrainingState): TrainingState => JSON.parse(JSON.stringify(state));
const rows = (d: Db) => d.collection<TrainingDailyDoc>('trainingDaily');
async function daily(d: Db, userId: string, session?: ClientSession): Promise<TrainingDailyDoc> {
  const now = Date.now(), day = utcDay(now), key = `${userId}:${day}`;
  const row = await rows(d).findOne({ _id: key }, { session }); if (row) return row;
  const fresh: TrainingDailyDoc = { _id: key, userId, day, state: newGuestTraining(now), createdAt: new Date(now), updatedAt: new Date(now), expiresAt: new Date(now + 30 * 86400000) };
  await rows(d).updateOne({ _id: key }, { $setOnInsert: fresh }, { upsert: true, session });
  return (await rows(d).findOne({ _id: key }, { session }))!;
}
async function snapshot(d: Db, row: TrainingDailyDoc, session?: ClientSession): Promise<TrainingState> {
  const user = await d.collection<UserDoc>('users').findOne({ _id: row.userId }, { session, projection: { trainingBuff: 1 } });
  return { ...row.state, serverNow: Date.now(), pendingBuff: user?.trainingBuff === true, weaknesses: await readWeaknesses(d, row.userId, session) };
}
async function save(d: Db, row: TrainingDailyDoc, session: ClientSession) {
  row.state = clean(row.state); row.updatedAt = new Date();
  await rows(d).replaceOne({ _id: row._id }, row, { session });
  return snapshot(d, row, session);
}
function checkIdentity(body: Record<string, unknown>, state: TrainingState) {
  if (body.day !== utcDay() || body.day !== state.day) throw new Problem('A new practice day has begun. Refresh your daily set.', 409, 'day_changed');
  if (!state.plan || body.planId !== state.plan.id) throw new Problem('This practice set is no longer active.', 409, 'plan_changed');
}
async function change(userId: string, body: Record<string, unknown>, work: (d: Db, row: TrainingDailyDoc, session: ClientSession) => Promise<TrainingState>) {
  return transaction(async (d, session) => { const row = await daily(d, userId, session); row.state = await snapshot(d, row, session); checkIdentity(body, row.state); return work(d, row, session); });
}
function guestFacts(body: Record<string, unknown>) {
  if (body.final === true && object(body.plan)) {
    const regiment = validateRegiment(body.plan.regiment), plan = regiment ? validatePlan(body.plan, regiment) : null;
    if (!plan || !Array.isArray(body.receipts) || body.receipts.length !== 4) return null;
    const notes = [];
    for (let i = 0; i < 4; i++) {
      const receipt = body.receipts[i];
      if (!object(receipt) || receipt.exerciseId !== plan.exercises[i].id) return null;
      const result = validateTrainingResults(plan.exercises[i].music, regiment!.instrument, receipt.notes); if (!result) return null;
      notes.push(...result);
    }
    return { exercise: plan.exercises[3].music, notes, final: true };
  }
  const exercise = validateExercise(body.exercise), notes = exercise ? validateTrainingResults(exercise, body.instrument as InstrumentId, body.notes) : null;
  return exercise && notes && typeof body.final === 'boolean' ? { exercise, notes, final: body.final } : null;
}
export async function trainingRequest(request: Request, action: Action) {
  return handled(async () => {
    try {
      if (request.method !== 'GET') { const guard = mutation(request); if (guard) return guard; }
      const body = request.method === 'GET' ? {} : await readJson(request, 48 * 1024); if (body instanceof Response) return body;
      const user = await currentUser();
      if (action === 'state') return json(user ? await transaction(async (d, s) => snapshot(d, await daily(d, user._id, s), s)) : newGuestTraining());
      if (action === 'profile') {
        // The mentor's player file. Guests have none on the server: theirs lives in the tab's memory.
        if (!user) return json({ error: 'Guests keep their practice file in memory.', code: 'guest' }, 401);
        const blocked = await limit(`training-profile:${user._id}`, 60, 600000); if (blocked) return blocked;
        return json(await readMentorProfile(await db(), user));
      }
      if (['plan', 'feedback', 'voice'].includes(action)) {
        const blocked = await limit(`training-${action}:${user?._id ?? clientIp(request)}`, action === 'voice' ? 40 : 20, 600000); if (blocked) return blocked;
        const global = await limit(`training-${action}:global`, action === 'voice' ? 160 : 100, 60000); if (global) return global;
      }
      if (action === 'plan') {
        const regiment = validateRegiment(body.regiment); if (!regiment) throw new Problem('Choose a valid practice regiment.');
        const before = user ? await transaction(async (d, s) => snapshot(d, await daily(d, user._id, s), s)) : newGuestTraining(Date.now(), false, validateWeaknesses(body.weaknesses) ?? undefined);
        if (user && before.plan && !body.replace) return json(before);
        if (user && body.replace && (!int(body.expectedRevision) || body.expectedRevision !== before.revision)) throw new Problem('This set changed in another window. Refresh it first.', 409, 'revision_changed');
        const plan = await createTrainingPlan(regiment, before.weaknesses, randomUUID());
        if (!user) return json(guestStartPlan(before, plan));
        return json(await transaction(async (d, s) => {
          const row = await daily(d, user._id, s);
          if (row.day !== before.day) throw new Problem('A new practice day has begun.', 409, 'day_changed');
          if (row.state.revision !== before.revision) { if (!body.replace && row.state.plan) return snapshot(d, row, s); throw new Problem('This set changed in another window.', 409, 'revision_changed'); }
          row.state = guestStartPlan(await snapshot(d, row, s), plan); return save(d, row, s);
        }));
      }
      if (action === 'voice') {
        if (body.speaker !== 'castor' && body.speaker !== 'pollux') throw new Problem('Choose a mentor voice.');
        let feedback = readVoiceTicket(body.voiceToken);
        if (!feedback && user) {
          const d = await db(), row = await daily(d, user._id); checkIdentity(body, row.state);
          feedback = body.exerciseId === 'final' ? row.state.finalFeedback ?? null : row.state.receipts.find(r => r.exerciseId === body.exerciseId)?.feedback ?? null;
        }
        if (!feedback && !user) {
          const facts = guestFacts(body);
          if (facts) feedback = offlineFeedback(facts.exercise, facts.notes, facts.final);
        }
        if (!feedback) throw new Problem('No practice feedback is ready to speak.');
        return trainingVoice(feedback, body.speaker);
      }
      if (action === 'feedback') {
        if (!user) {
          const facts = guestFacts(body); if (!facts) throw new Problem('Invalid practice feedback facts.');
          const feedback = await createTrainingFeedback(facts.exercise, facts.notes, facts.final); return json({ feedback, voiceToken: voiceTicket(feedback) });
        }
        const d = await db(), before = await daily(d, user._id); checkIdentity(body, before.state);
        const final = body.exerciseId === 'final';
        const receipt = before.state.receipts.find(r => r.exerciseId === body.exerciseId);
        const ex = final ? before.state.plan!.exercises[3] : before.state.plan!.exercises.find(e => e.id === body.exerciseId);
        if (!ex || (!final && !receipt) || (final && before.state.receipts.length !== 4)) throw new Problem('Finish the exercise before requesting feedback.');
        const notes = final ? before.state.receipts.flatMap(r => r.notes) : receipt!.notes;
        const cached = final ? before.state.finalFeedback : receipt!.feedback;
        if (cached?.source === 'gemini') return json({ feedback: cached, voiceToken: voiceTicket(cached), state: await snapshot(d, before) });
        const feedback = await createTrainingFeedback(ex.music, notes, final);
        const state = await change(user._id, body, async (database, row, session) => {
          if (final) row.state.finalFeedback = feedback;
          else { const target = row.state.receipts.find(r => r.exerciseId === body.exerciseId); if (!target) throw new Problem('Feedback no longer available.', 409); target.feedback = feedback; }
          return save(database, row, session);
        });
        return json({ feedback, voiceToken: voiceTicket(feedback), state });
      }
      if (!user) return json({ error: 'Sign in to save training. Guests practise in memory.' }, 401);
      return json(await change(user._id, body, async (d, row, session) => {
        const state = row.state;
        if (action === 'begin') {
          if (state.status === 'complete') throw new Problem('Start another set to keep practising.', 409);
          if (body.exerciseId !== state.plan!.exercises[state.nextIndex]?.id) throw new Problem('Start the next exercise in order.', 409);
          if (state.activeAttempt) return state;
          row.state = guestBegin(state); return save(d, row, session);
        }
        if (action === 'pause') {
          if (!['pause', 'resume', 'end'].includes(String(body.action))) throw new Problem('Choose a valid practice action.');
          if (body.expectedRevision !== undefined && body.expectedRevision !== state.revision) throw new Problem('This practice set changed. Refresh it first.', 409, 'revision_changed');
          row.state = body.action === 'end' ? { ...state, plan: null, receipts: [], nextIndex: 0, status: 'ready', activeAttempt: undefined, finalFeedback: undefined, revision: state.revision + 1 } : { ...state, status: state.status === 'complete' ? 'complete' : body.action === 'pause' ? 'paused' : 'ready', activeAttempt: undefined, revision: state.revision + 1 };
          return save(d, row, session);
        }
        if (action === 'result') {
          const raw = object(body.result) ? body.result : body;
          if (typeof raw.exerciseId !== 'string' || typeof raw.attemptId !== 'string' || typeof raw.simulated !== 'boolean') throw new Problem('Invalid result.');
          const previous = state.receipts.find(r => r.attemptId === raw.attemptId);
          if (previous) {
            const previousExercise = state.plan!.exercises.find(e => e.id === previous.exerciseId)!;
            const retryNotes = validateTrainingResults(previousExercise.music, state.plan!.regiment.instrument, raw.notes);
            if (!retryNotes || performanceDigest({ notes: previous.notes, simulated: previous.simulated, exerciseId: previous.exerciseId }) !== performanceDigest({ notes: retryNotes, simulated: raw.simulated, exerciseId: raw.exerciseId })) throw new Problem('This exercise was already recorded with different results.', 409);
            return state;
          }
          const ex = state.plan!.exercises[state.nextIndex];
          if (!ex || ex.id !== raw.exerciseId || state.activeAttempt?.id !== raw.attemptId) throw new Problem('This exercise is no longer active.', 409);
          if (Date.now() < state.activeAttempt.startAt + exerciseDurationMs(ex.music) - 250) throw new Problem('Finish playing the phrase before submitting.', 409, 'too_early');
          const notes = validateTrainingResults(ex.music, state.plan!.regiment.instrument, raw.notes); if (!notes) throw new Problem('Invalid note results.');
          const result: TrainingResult = { exerciseId: raw.exerciseId, attemptId: raw.attemptId, notes, simulated: raw.simulated };
          row.state = guestSubmit(state, result);
          if (row.state.status === 'complete') row.completedAt ??= new Date();
          row.state.weaknesses = await recordPerformance(d, session, user._id, 'training', raw.attemptId, state.plan!.regiment.instrument, ex.music, notes, raw.simulated);
          return save(d, row, session);
        }
        if (action === 'claim') {
          if (state.claimed) return state;
          if (state.pendingBuff) throw new Problem('Use your banked training tips on a new climb first.', 409, 'already_banked');
          if (state.status !== 'complete' || state.receipts.length !== 4) throw new Problem('Finish today’s set before claiming.', 409, 'incomplete');
          row.state = guestClaim(state);
          await d.collection<UserDoc>('users').updateOne({ _id: user._id }, { $set: { trainingBuff: true } }, { session });
          return save(d, row, session);
        }
        throw new Problem('Unknown practice action.');
      }));
    } catch (e) { if (e instanceof Problem) return json({ error: e.message, code: e.code, serverNow: Date.now() }, e.status); throw e; }
  });
}
