import { useGame } from '../store';

export function Title() {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="screen">
      <h1>Kill the Squire</h1>
      <p style={{ color: 'var(--ink-dim)' }}>Sight-Reading Spire — ShellHacks 2026</p>
      <button onClick={() => setScreen('keySelect')}>Start Campaign</button>
    </div>
  );
}
