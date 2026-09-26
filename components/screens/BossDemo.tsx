'use client';
// Boss Demo: jump straight into any act's boss fight to see the boss stage.
// The fight runs on a throwaway run (store.startBossDemo) — nothing is saved,
// logged or posted, and the real run/checkpoint is handed back afterwards.

import { sfx } from '@/lib/audio';
import { ENEMIES, INSTRUMENTS } from '@/lib/content';
import { instrumentOf, useGame } from '@/lib/store';
import { Sprite } from '../ui';
import { MenuShell } from './Menus';

const BOSSES = ENEMIES.map((e, idx) => ({ e, idx })).filter(({ e }) => e.boss);

export function BossDemo() {
  const run = useGame((s) => s.run);
  const demo = useGame((s) => s.demoMode);
  const inst = instrumentOf(run);

  const cycleInstrument = () => {
    sfx('click');
    const i = INSTRUMENTS.findIndex((x) => x.id === inst.id);
    useGame.getState().chooseInstrument(INSTRUMENTS[(i + 1) % INSTRUMENTS.length].id);
  };

  return (
    <MenuShell title="BOSS DEMO">
      <div className="f-body" style={{ position: 'absolute', left: 0, top: 168, width: 1440, textAlign: 'center', fontSize: 17, color: 'var(--soft)' }}>
        Pick a boss to fight right now. Nothing here is saved; your climb stays untouched. Reading as{' '}
        <button onClick={cycleInstrument} style={{ color: 'var(--sun)', textDecoration: 'underline', font: 'inherit' }}>
          {inst.name.toLowerCase()} ({inst.keyLabel})
        </button>
        .
      </div>

      <div style={{ position: 'absolute', left: 150, top: 215, width: 1140, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {BOSSES.map(({ e, idx }) => (
          <button
            key={e.id}
            className="hoverable pressable"
            onMouseEnter={() => sfx('hover')}
            onClick={() => { sfx('click'); useGame.getState().startBossDemo(idx); }}
            style={{ position: 'relative', height: 230, overflow: 'hidden', textAlign: 'left', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 3px inset, rgba(0,0,0,0.5) 8px 8px 0', background: '#14162E' }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${e.bg})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `${e.bgFilter ?? ''} brightness(0.45)` }} />
            <Sprite src={e.sprite} x={190} y={40} size={170} />
            <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', flexDirection: 'column', gap: 8, width: 190 }}>
              <span className="f-label" style={{ fontSize: 11, color: 'var(--sun)' }}>ACT {e.act} · FLOOR {e.floor}</span>
              <span className="f-press" style={{ fontSize: 15, lineHeight: '20px', color: 'var(--parchment)', textShadow: '#101126 3px 3px 0' }}>{e.name.toUpperCase()}</span>
              <span className="f-body" style={{ fontSize: 14, color: 'var(--soft)' }}>{e.place}</span>
            </div>
            <div className="f-label" style={{ position: 'absolute', left: 16, bottom: 14, fontSize: 11, color: 'var(--soft)', display: 'flex', gap: 14 }}>
              <span style={{ color: 'var(--hp)' }}>♥ {e.hp}</span>
              <span>♩ = {e.tempo}</span>
              {e.act === 1 && <span style={{ color: 'var(--magenta)' }}>VOICED</span>}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => { sfx('click'); useGame.getState().setDemo(!demo); }}
        className="f-label"
        style={{ position: 'absolute', left: 0, top: 740, width: 1440, textAlign: 'center', fontSize: 12, color: demo ? 'var(--sun)' : 'var(--muted)' }}
      >
        {demo ? '■ DEMO MODE ON: NOTES ARE SIMULATED, NO INSTRUMENT NEEDED' : '□ NO INSTRUMENT? TURN ON DEMO MODE'}
      </button>
    </MenuShell>
  );
}
