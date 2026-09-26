/**
 * Sprite.tsx — a player/enemy character image (PRD §3). PLACEHOLDER.
 * TODO(team): render sprite art + simple animations (hit, fall on loss).
 */
export function Sprite({ kind }: { kind: 'player' | 'enemy' | 'boss' }) {
  return <div className={`sprite sprite-${kind}`}>{kind}</div>;
}
