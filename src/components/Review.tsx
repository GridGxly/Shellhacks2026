/**
 * Review.tsx — shown at the end of a recording (PRD §3, §7). PLACEHOLDER.
 *
 * Fully marked staff + score (% correct) + "Hit!" / "Missed", held for
 * REVIEW_DURATION_MS, then closes and combat resolves.
 *
 * TODO(team): render the marked Staff + score from NoteResult[].
 */
import type { NoteResult } from '../types';

export function Review({ results }: { results: NoteResult[] }) {
  const correct = results.filter((r) => r.correct).length;
  return (
    <div className="review">
      TODO: review — {correct}/{results.length} correct (PRD §7)
    </div>
  );
}
