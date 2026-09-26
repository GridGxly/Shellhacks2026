import { useGame } from '../store';

/** Shown after the boss (PRD §2 step 7). "Start New Adventure" resets the run. */
export function FinalVictory() {
  const resetRun = useGame((s) => s.resetRun);
  return (
    <div className="screen">
      <h2>You beat the Spire!</h2>
      <button onClick={resetRun}>Start New Adventure</button>
    </div>
  );
}
