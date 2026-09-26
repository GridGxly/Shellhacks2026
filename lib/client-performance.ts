import type { PerformanceInput, PerformanceSource, WeaknessSummary } from './training-types';
import { emptyWeaknesses, mergePerformance, validateWeaknesses } from './training-core';

// Guest practice belongs to this in-memory identity, never to the next account.
let guestSummary = emptyWeaknesses();
const guestReceipts = new Set<string>();
export const guestWeaknesses = (): WeaknessSummary => structuredClone(guestSummary);
export const getGuestWeaknesses = guestWeaknesses;
export function setGuestWeaknesses(summary: WeaknessSummary) {
  guestSummary = validateWeaknesses(summary) ?? emptyWeaknesses();
}
export function clearGuestPractice() {
  guestSummary = emptyWeaknesses();
  guestReceipts.clear();
}
export function recordGuestPerformance(input: Omit<PerformanceInput, 'source'> & { source: PerformanceSource }) {
  const key = `${input.source}:${input.attemptId}`;
  if (guestReceipts.has(key)) return;
  guestReceipts.add(key);
  guestSummary = mergePerformance(guestSummary, input.exercise, input.notes, input.source, input.simulated);
}
/** Learning reports must never hold up combat or change its grade/rewards. */
export async function reportAdventurePerformance(input: Omit<PerformanceInput, 'source'>, signedIn: boolean): Promise<boolean> {
  const performance = { ...input, source: 'adventure' as const };
  if (!signedIn) { recordGuestPerformance(performance); return true; }
  try {
    const response = await fetch('/api/performance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(performance), keepalive: true, signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch { return false; }
}
