import { useGame } from '../store';

/** Loss screen (PRD §2 step 8). "Continue" resets ALL run data and returns to title. */
export function Loss() {
  const resetRun = useGame((s) => s.resetRun);
  return (
    <div className="screen">
      <h2>You fell.</h2>
      {/* TODO(team): fallen player sprite + background fades to dark red (PRD §7). */}
      <button onClick={resetRun}>Continue</button>
    </div>
  );
}
