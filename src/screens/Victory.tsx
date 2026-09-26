import { useGame } from '../store';

/** Regular-enemy victory (PRD §2 step 5). Player heals to full, then back to map. */
export function Victory() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="screen">
      <h2>Victory</h2>
      {/* TODO(team): heal player to full PLAYER_HP and mark the node beaten before returning. */}
      <button onClick={() => setScreen('map')}>Proceed</button>
    </div>
  );
}
