'use client';
import { useEffect, useState } from 'react';
import { playMusic, sfx } from '@/lib/audio';
import { INSTRUMENTS } from '@/lib/content';
import { useGame } from '@/lib/store';
import { Arrow, Bg, KeyHint, Sprite, YellowButton } from '../ui';

// instruments.png is 1776x592: six 296px cells, icons centred around y=300.
const CELL = 296;

function Icon({ i, scale, style }: { i: number; scale: number; style?: React.CSSProperties }) {
  const w = 120 * scale;
  const k = w / CELL;
  return (
    <div
      style={{
        width: w,
        height: 150 * scale,
        backgroundImage: 'url(/assets/sprites/instruments.png)',
        backgroundSize: `${1776 * k}px ${592 * k}px`,
        backgroundPosition: `${-i * CELL * k}px ${-115 * k}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  );
}

export default function ChooseInstrument() {
  const run = useGame((s) => s.run);
  const go = useGame((s) => s.go);
  const [idx, setIdx] = useState(Math.max(0, INSTRUMENTS.findIndex((i) => i.id === run.instrument)));
  const [dir, setDir] = useState(0);
  const inst = INSTRUMENTS[idx];

  useEffect(() => playMusic('map'), []);
  const move = (d: number) => {
    sfx('hover');
    setDir(d);
    setIdx((i) => (i + d + INSTRUMENTS.length) % INSTRUMENTS.length);
  };
  const choose = () => {
    useGame.getState().chooseInstrument(inst.id);
    sfx('upgrade');
    go('map');
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'Enter') choose();
      if (e.key === 'Escape') { sfx('back'); go('title'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="fill" style={{ background: '#140d0a' }}>
      <Bg src="/assets/bg/showroom.png" style={{ filter: 'brightness(0.55)' }} />
      <div className="fill" style={{ background: 'linear-gradient(180deg, rgba(16,17,38,0.4), rgba(16,17,38,0.1) 40%, rgba(16,17,38,0.85))' }} />
      {/* Spotlight cone */}
      <div style={{ position: 'absolute', left: 520, top: -40, width: 400, height: 720, background: 'linear-gradient(180deg, rgba(255,230,150,0.35), rgba(255,230,150,0.05))', clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)', animation: 'glow 3s steps(4) infinite' }} />
      <div style={{ position: 'absolute', left: 560, top: 600, width: 320, height: 40, borderRadius: '50%', background: 'rgba(255,230,150,0.25)' }} />

      <div className="f-label" style={{ position: 'absolute', left: 0, top: 44, width: 1440, textAlign: 'center', fontSize: 14, color: 'var(--sun)', letterSpacing: '0.22em' }}>THE SHOWROOM</div>
      <div className="f-press" style={{ position: 'absolute', left: 0, top: 70, width: 1440, textAlign: 'center', fontSize: 30, color: 'var(--parchment)', textShadow: '#101126 4px 4px 0' }}>CHOOSE YOUR INSTRUMENT</div>

      {/* Riff, equipped */}
      <div style={{ position: 'absolute', left: 60, top: 250, width: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Sprite key={inst.id} src={inst.sprite} x={0} y={0} size={360} style={{ position: 'relative', animation: 'popIn 300ms steps(5) both, breathe 1.2s 300ms steps(2) infinite' }} />
        <div className="f-press" style={{ marginTop: 6, padding: '6px 12px', background: 'var(--meadow)', color: '#101126', fontSize: 11 }}>EQUIPPED</div>
      </div>

      {/* Floating instrument */}
      <button onClick={() => move(-1)} className="hoverable" style={{ position: 'absolute', left: 470, top: 360 }} aria-label="Previous"><Arrow dir="left" size={56} /></button>
      <div key={idx} style={{ position: 'absolute', left: 540, top: 230, width: 360, height: 400, display: 'grid', placeItems: 'center', animation: `${dir >= 0 ? 'slideInRight' : 'slideInLeft'} 260ms steps(5) both` }}>
        <div style={{ animation: 'bob 1.6s steps(4) infinite' }}><Icon i={inst.iconIndex} scale={2.6} /></div>
      </div>
      <button onClick={() => move(1)} className="hoverable" style={{ position: 'absolute', left: 914, top: 360 }} aria-label="Next"><Arrow size={56} /></button>

      {/* Info card */}
      <div key={`card-${idx}`} style={{ position: 'absolute', left: 1000, top: 250, width: 380, display: 'flex', flexDirection: 'column', gap: 16, padding: 24, background: 'rgba(16,17,38,0.92)', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 3px inset, #D1307E 6px 6px 0', animation: 'fadeIn 250ms steps(4) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="f-press" style={{ fontSize: 20, color: '#fff' }}>{inst.name.toUpperCase()}</div>
          <div className="f-press" style={{ padding: '6px 10px', background: 'var(--sun)', color: '#101126', fontSize: 13 }}>{inst.keyLabel}</div>
        </div>
        <div className="f-body" style={{ fontSize: 19, lineHeight: '25px', color: 'var(--parchment)' }}>{inst.personality}</div>
        {[['READS IN', inst.readsIn], ['RANGE', inst.range]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #2A2F55', paddingTop: 12 }}>
            <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>{k}</span>
            <span className="f-body" style={{ fontSize: 16, color: 'var(--soft)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Icon strip */}
      <div style={{ position: 'absolute', left: 0, top: 690, width: 1440, display: 'flex', justifyContent: 'center', gap: 12 }}>
        {INSTRUMENTS.map((it, i) => (
          <button
            key={it.id}
            onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); sfx('hover'); }}
            style={{ width: 96, height: 84, display: 'grid', placeItems: 'center', background: i === idx ? '#2A2F55' : 'rgba(16,17,38,0.8)', border: `3px solid ${i === idx ? 'var(--sun)' : '#3A3F70'}`, transform: i === idx ? 'translateY(-6px)' : undefined, transition: 'transform 100ms steps(2)' }}
          >
            <Icon i={it.iconIndex} scale={0.55} />
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, top: 808, width: 1440, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40 }}>
        <button className="f-label" onClick={() => { sfx('back'); go('title'); }} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}><KeyHint k="ESC" /> BACK</button>
        <YellowButton onClick={choose}>CHOOSE {inst.name.toUpperCase()}</YellowButton>
        <div className="f-label kbd-only" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}><KeyHint k="← →" /> BROWSE</div>
      </div>
    </div>
  );
}
