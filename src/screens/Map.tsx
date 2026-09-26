import { useGame } from '../store';

/** Named GameMap (not Map) to avoid clashing with the built-in Map type. */
export function GameMap() {
  const nodes = useGame((s) => s.nodes);

  return (
    <div className="screen">
      <h2>The Spire</h2>
      {/* Nodes are shown bottom-to-top in the real UI; boss node is larger (PRD §3). */}
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1rem', alignItems: 'center' }}>
        {nodes.map((n) => (
          <div
            key={n.id}
            style={{
              padding: n.type === 'boss' ? '1.5rem 2rem' : '1rem 1.5rem',
              background: 'var(--bg-panel)',
              borderRadius: 8,
              opacity: n.status === 'locked' ? 0.4 : 1,
            }}
          >
            {n.type === 'boss' ? '♛ Boss' : '⚔ Enemy'} — {n.status}
            {n.status === 'beaten' && ' ✕'}
          </div>
        ))}
      </div>
      {/* TODO(team): clicking the next available node should call enterNode(n.id) -> 'combat'. */}
      <p style={{ color: 'var(--ink-dim)' }}>TODO: wire node clicks to start a fight (PRD §4).</p>
    </div>
  );
}
