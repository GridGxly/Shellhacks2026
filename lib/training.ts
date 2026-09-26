'use client';
import { guestBegin, guestClaim, guestStartPlan, guestSubmit, makeOfflinePlan, newGuestTraining, refreshGuestTraining } from './training-core';
import { clearGuestPractice, guestWeaknesses, setGuestWeaknesses } from './client-performance';
import type { TrainingFeedback, TrainingRegiment, TrainingResult, TrainingState } from './training-types';

let guestState: TrainingState | null = null;
let owner: string | null | undefined;
export function resetTrainingMemory(identity: string | null) {
  if ((owner !== undefined && owner !== identity) || (owner === undefined && identity !== null)) { guestState = null; clearGuestPractice(); }
  owner = identity;
}
export class TrainingError extends Error {
  constructor(message: string, public state?: TrainingState, public code?: string) { super(message); }
}

async function request<T>(path: string, body: unknown | undefined, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/training${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  const data = await response.json();
  if (!response.ok) throw new TrainingError(data.error || 'Practice could not be saved. Please retry.', data.state, data.code);
  return data as T;
}

/** Signed practice is server-owned; a guest's plan, progress and history stay in this tab's memory. */
export class TrainingClient {
  constructor(public readonly identity: string | null, private readonly signal: AbortSignal) { resetTrainingMemory(identity); }
  async load(pendingBuff: boolean): Promise<TrainingState> {
    if (this.identity) return request('', undefined, this.signal);
    guestState = refreshGuestTraining(guestState ?? newGuestTraining());
    guestState = { ...guestState, pendingBuff, weaknesses: guestWeaknesses() };
    return guestState;
  }
  async plan(state: TrainingState, regiment: TrainingRegiment, replace = false): Promise<TrainingState> {
    if (this.identity) return request('/plan', { regiment, expectedRevision: state.revision, replace, day: state.day }, this.signal);
    const expectedGuest = guestState;
    let plan = makeOfflinePlan(regiment, guestWeaknesses());
    try {
      const generated = await request<TrainingState>('/plan', { regiment, weaknesses: guestWeaknesses() }, this.signal);
      if (generated.plan) plan = generated.plan;
    } catch (err) { if (this.signal.aborted) throw err; }
    if (this.signal.aborted || owner !== this.identity || guestState !== expectedGuest) throw new DOMException('Practice changed while preparing the set.', 'AbortError');
    guestState = guestStartPlan(state, plan);
    return guestState;
  }
  async begin(state: TrainingState): Promise<TrainingState> {
    if (this.identity) return request('/begin', { day: state.day, planId: state.plan!.id, exerciseId: state.plan!.exercises[state.nextIndex].id }, this.signal);
    guestState = guestBegin(state); return guestState;
  }
  async submit(state: TrainingState, result: TrainingResult): Promise<TrainingState> {
    if (this.identity) return request('/result', { day: state.day, planId: state.plan!.id, result }, this.signal);
    guestState = guestSubmit(state, result); setGuestWeaknesses(guestState.weaknesses); return guestState;
  }
  async pause(state: TrainingState, action: 'pause' | 'resume' | 'end'): Promise<TrainingState> {
    if (this.identity) return request('/pause', { day: state.day, planId: state.plan?.id, expectedRevision: state.revision, action }, this.signal);
    const current = refreshGuestTraining(state);
    guestState = action === 'end'
      ? { ...newGuestTraining(Date.now(), current.pendingBuff, guestWeaknesses()), claimed: current.claimed, revision: current.revision + 1 }
      : { ...current, activeAttempt: undefined, status: current.status === 'complete' ? 'complete' : action === 'pause' ? 'paused' : 'ready', revision: current.revision + 1 };
    return guestState;
  }
  async claim(state: TrainingState): Promise<TrainingState> {
    if (this.identity) return request('/claim', { day: state.day, planId: state.plan!.id }, this.signal);
    guestState = guestClaim(state); return guestState;
  }
  async feedback(state: TrainingState, final = false): Promise<{ state: TrainingState; feedback: TrainingFeedback; voiceToken?: string }> {
    const receipt = state.receipts.at(-1)!;
    const fallback = final ? state.finalFeedback! : receipt.feedback;
    if (!this.identity) {
      const expectedGuest = guestState;
      const exercise = state.plan!.exercises.find(ex => ex.id === receipt.exerciseId)!.music;
      try {
        const coached = await request<{ feedback: TrainingFeedback; voiceToken?: string }>('/feedback', final ? { plan: state.plan, receipts: state.receipts, final: true } : { exercise, notes: receipt.notes, instrument: state.plan!.regiment.instrument, final: false }, this.signal);
        if (this.signal.aborted || owner !== this.identity || guestState !== expectedGuest) throw new DOMException('Practice changed while coaching.', 'AbortError');
        guestState = final ? { ...guestState!, finalFeedback: coached.feedback } : { ...guestState!, receipts: guestState!.receipts.map(r => r.exerciseId === receipt.exerciseId ? { ...r, feedback: coached.feedback } : r) };
        return { state: guestState, feedback: coached.feedback, voiceToken: coached.voiceToken };
      } catch (err) { if (this.signal.aborted) throw err; return { state, feedback: fallback }; }
    }
    const result = await request<{ state?: TrainingState; feedback: TrainingFeedback; voiceToken?: string }>('/feedback', { day: state.day, planId: state.plan!.id, exerciseId: final ? 'final' : receipt.exerciseId }, this.signal);
    return { state: result.state ?? state, feedback: result.feedback, voiceToken: result.voiceToken };
  }
  voiceBody(state: TrainingState, speaker: 'castor' | 'pollux', final = false, voiceToken?: string) {
    if (voiceToken) return { voiceToken, speaker };
    const receipt = state.receipts.at(-1)!;
    if (this.identity) return { day: state.day, planId: state.plan!.id, exerciseId: final ? 'final' : receipt.exerciseId, speaker };
    if (final) return { speaker, plan: state.plan, receipts: state.receipts, final: true };
    const music = state.plan!.exercises.find(ex => ex.id === receipt.exerciseId)!.music;
    // Guest voice uses the exact same measured facts as the visible built-in feedback.
    return { speaker, exercise: music, notes: receipt.notes, final: false, instrument: state.plan!.regiment.instrument };
  }
}
