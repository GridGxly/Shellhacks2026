/**
 * UltimateButton.tsx — boss-only round button (PRD §3, §4). PLACEHOLDER.
 *
 * Glows when charged (clickable), dimmed when not. Charge logic (PRD §8):
 *   charged = (round === 1 && !failedOnce) || hand.length === 0
 *
 * TODO(team): render charged/dimmed state and fire playUltimate().
 */
export function UltimateButton({ charged }: { charged: boolean }) {
  return (
    <button className="ultimate" disabled={!charged}>
      Ultimate
    </button>
  );
}
