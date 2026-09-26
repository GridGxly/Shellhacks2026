/**
 * RecordingOverlay.tsx — opens over combat when a card/ultimate is played (PRD §3, §6).
 *
 * Shows tempo, the Staff (abcjs), the moving cursor, the count-in indicator, and
 * per-note feedback. The ultimate version is larger and shows multiple lines.
 * Uses clock.ts (shared clock), pitch.ts (mic), onset.ts, grade.ts.
 *
 * TODO(team): wire count-in -> record -> grade -> Review.
 */
export function RecordingOverlay() {
  return <div className="overlay">TODO: recording overlay (PRD §6)</div>;
}
