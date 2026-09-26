import { useGame } from '../store';
import { INSTRUMENT_KEYS } from '../config';
import type { KeyId } from '../config';

export function KeySelect() {
  const selectKey = useGame((s) => s.selectKey);
  const keys = Object.keys(INSTRUMENT_KEYS) as KeyId[];

  return (
    <div className="screen">
      <h2>Pick the key your instrument reads in</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        {keys.map((k) => (
          <button key={k} onClick={() => selectKey(k)}>
            {INSTRUMENT_KEYS[k].label}
          </button>
        ))}
      </div>
      <p style={{ color: 'var(--ink-dim)' }}>Treble clef only for now.</p>
    </div>
  );
}
