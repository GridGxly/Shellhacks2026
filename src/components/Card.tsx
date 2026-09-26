/**
 * Card.tsx — one card in the hand (PRD §3, §5). PLACEHOLDER.
 *
 * Drag toward the enemy to play (releasing over the enemy opens the recording
 * overlay). On pass: shrink + fly off. On fail: slide back into the hand (§4).
 *
 * TODO(team): render the card face by type and add the drag interaction.
 */
import type { CardType } from '../types';

export function Card({ type }: { type: CardType }) {
  return <div className="card">{type}</div>;
}
