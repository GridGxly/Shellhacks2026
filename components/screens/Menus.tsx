'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { sfx } from '@/lib/audio';
import { mic, type Reading } from '@/lib/mic';
import { INSTRUMENTS } from '@/lib/content';
import { instrumentOf, useGame } from '@/lib/store';
import { noteName, writtenKey } from '@/lib/music';
import { Arrow, Bg, FloatingNotes, Ornament, Sprite } from '../ui';

export function MenuShell({ title, children, onBack }: { title: string; children: ReactNode; onBack?: () => void }) {
  const go = useGame((s) => s.go);
  const back = onBack ?? (() => go('title'));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !useGame.getState().overlay && (sfx('back'), back());
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="fill" style={{ background: '#101126' }}>
      <Bg src="/assets/bg/summit.png" style={{ filter: 'brightness(0.26) saturate(0.6) blur(3px)' }} />
      <div style={{ position: 'absolute', left: 420, top: -100, width: 600, height: 900, backgroundImage: 'radial-gradient(ellipse 50% 60% at 50% 15%, rgba(255,246,224,0.12) 0%, rgba(255,246,224,0) 70%)' }} />
      <div className="fill" style={{ backgroundImage: 'radial-gradient(ellipse 70% 70% at 50% 45%, rgba(16,17,38,0) 30%, rgba(16,17,38,0.9) 100%)' }} />
      <div style={{ opacity: 0.3 }}><FloatingNotes count={8} /></div>
      <div style={{ position: 'absolute', left: 0, top: 84, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div className="f-press" style={{ fontSize: 36, lineHeight: '40px', color: 'var(--parchment)', textShadow: '#101126 4px 4px 0, rgba(255,210,63,0.35) 0 0 18px', animation: 'dropIn 300ms steps(5) both' }}>{title}</div>
        <Ornament />
      </div>
      <div style={{ animation: 'fadeIn 300ms 180ms both' }}>{children}</div>
      <button
        onMouseEnter={() => sfx('hover')}
        onClick={() => { sfx('back'); back(); }}
        style={{ position: 'absolute', left: 0, top: 800, width: 1440, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}
      >
        <Arrow />
        <span className="f-press" style={{ fontSize: 20, color: '#fff', textShadow: '#101126 3px 3px 0, rgba(255,210,63,0.6) 0 0 12px' }}>BACK</span>
        <Arrow dir="left" />
      </button>
    </div>
  );
}

const panel = { background: 'rgba(16,17,38,0.75)', border: '3px solid #3A3F70' } as const;

export function HowToPlay() {
  const steps = [
    {
      n: 1, title: 'PICK A CARD', body: 'Drag Chord, Rhythm or Scale onto the enemy. One card per round.',
      art: (
        <>
          <div style={{ position: 'absolute', left: 46, top: 40, width: 150, height: 200, background: '#C9901B', border: '4px solid #101126', boxShadow: '#FFE08A 0 0 0 3px inset', rotate: '-8deg', animation: 'bob 2s steps(4) infinite' }}>
            <div className="f-press" style={{ margin: 8, padding: 6, background: 'var(--parchment)', color: '#101126', fontSize: 10, textAlign: 'center' }}>RHYTHM</div>
            <div className="f-music" style={{ textAlign: 'center', fontSize: 40, color: '#fff' }}>♩♫♪</div>
          </div>
          <div style={{ position: 'absolute', left: 226, top: 60, width: 50, height: 50, border: '3px dashed var(--sun)', animation: 'blink 800ms steps(1) infinite' }} />
        </>
      ),
    },
    {
      n: 2, title: 'PLAY IT', body: 'After a 4-beat count-in, play the notes into your mic as the cursor sweeps.',
      art: (
        <div style={{ position: 'absolute', left: 20, top: 36, width: 254, height: 112, background: 'var(--parchment)', overflow: 'hidden' }}>
          {[30, 44, 58, 72, 86].map((y) => <div key={y} style={{ position: 'absolute', left: 10, top: y, width: 234, height: 2, background: '#1B1F3B' }} />)}
          {[40, 80, 150, 196].map((x, i) => <div key={x} style={{ position: 'absolute', left: x, top: 76 - i * 8, width: 14, height: 10, borderRadius: '50%', background: i < 2 ? '#3FA75C' : i === 2 ? '#1B1F3B' : '#9A9CB4' }} />)}
          <div style={{ position: 'absolute', left: 0, top: 18, width: 3, height: 80, background: 'var(--magenta)', animation: 'sweep 2.4s linear infinite' }} />
          <style>{`@keyframes sweep { from { transform: translateX(20px); } to { transform: translateX(240px); } }`}</style>
        </div>
      ),
    },
    {
      n: 3, title: 'LAND IT', body: 'Hit 80% of the notes and the card deals 30. Miss and it comes back with new music.',
      art: (
        <>
          <Sprite src="/assets/sprites/goblin.png" x={110} y={24} size={170} style={{ animation: 'hitFlash 1.6s steps(2) infinite' }} />
          <div className="f-press" style={{ position: 'absolute', left: 18, top: 30, fontSize: 34, color: '#FF4F5E', textShadow: '#101126 3px 0 0, #101126 -3px 0 0, #101126 0 3px 0, #101126 0 -3px 0, #FFD23F 4px 6px 0', animation: 'dmgPop 1.6s steps(8) infinite' }}>-30</div>
        </>
      ),
    },
  ];
  return (
    <MenuShell title="HOW TO PLAY">
      <div style={{ position: 'absolute', left: 0, top: 232, width: 1440, display: 'flex', justifyContent: 'center', gap: 48 }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 18, animation: `riseIn 400ms ${200 + i * 120}ms steps(5) both` }}>
            <div style={{ position: 'relative', width: 300, height: 200, overflow: 'hidden', ...panel }}>{s.art}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="f-press" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'var(--sun)', color: '#101126', fontSize: 14 }}>{s.n}</div>
              <div className="f-press" style={{ fontSize: 15, color: 'var(--parchment)' }}>{s.title}</div>
            </div>
            <div className="f-body" style={{ fontSize: 18, lineHeight: '24px', color: 'var(--soft)' }}>{s.body}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 222, top: 640, width: 996, display: 'flex', justifyContent: 'space-between', padding: '20px 28px', background: 'rgba(16,17,38,0.7)', borderTop: '3px solid #3A3F70', borderBottom: '3px solid #3A3F70', animation: 'fadeIn 400ms 600ms both' }}>
        {[
          ['TO WIN', 'Land all 3 cards', 'var(--sun)'],
          ['THEY HIT BACK', 'Every round, harder each act', 'var(--hp)'],
          ['AFTER A WIN', 'Heal + earn tips', 'var(--meadow)'],
          ['BOSSES', 'Play the ENCORE', '#FF7DB8'],
        ].map(([k, v, c]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="f-label" style={{ fontSize: 12, color: c }}>{k}</div>
            <div className="f-body" style={{ fontSize: 17, fontWeight: 500, color: 'var(--parchment)' }}>{v}</div>
          </div>
        ))}
      </div>
    </MenuShell>
  );
}

export function MicCheck() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState(mic.status);
  const run = useGame((s) => s.run);
  const demo = useGame((s) => s.demoMode);
  const inst = instrumentOf(run);
  const key = writtenKey(inst.writtenOffset);

  useEffect(() => {
    let alive = true;
    mic.start().then(() => alive && setStatus(mic.status));
    const l = (r: Reading) => setReading(r);
    mic.listeners.add(l);
    return () => {
      alive = false;
      mic.listeners.delete(l);
    };
  }, []);

  const written = reading?.stableMidi != null ? reading.stableMidi + inst.writtenOffset : null;
  const nearest = written != null ? Math.round(written) : null;
  const cents = written != null ? Math.round((written - nearest!) * 100) : 0;
  const level = reading ? Math.max(0, Math.min(10, Math.round((reading.rmsDb + 60) / 5))) : 0;
  const inTune = nearest != null && Math.abs(cents) <= 15;

  return (
    <MenuShell title="MIC CHECK">
      <div style={{ position: 'absolute', left: 370, top: 220, width: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '32px 40px', background: 'rgba(16,17,38,0.8)', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 3px inset' }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>INPUT</div>
          <div className="f-body" style={{ padding: '8px 14px', background: '#1E2140', border: '3px solid #3A3F70', fontSize: 17, color: 'var(--parchment)', maxWidth: 420, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {status === 'on' ? mic.deviceLabel : status === 'denied' ? 'Mic blocked: allow it in the address bar' : 'Waiting for permission…'}
          </div>
        </div>
        <div className="f-body" style={{ fontSize: 19, color: 'var(--soft)' }}>
          Hold a long written C on your{' '}
          {/* Readout is in this instrument's written key; click to cycle (Flute = concert pitch). */}
          <button
            onClick={() => {
              sfx('click');
              const i = INSTRUMENTS.findIndex((x) => x.id === inst.id);
              useGame.getState().chooseInstrument(INSTRUMENTS[(i + 1) % INSTRUMENTS.length].id);
            }}
            style={{ color: 'var(--sun)', textDecoration: 'underline', font: 'inherit' }}
          >
            {inst.name.toLowerCase()} ({inst.keyLabel})
          </button>
          .
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, height: 80 }}>
          <div key={nearest ?? 'x'} className="f-press" style={{ fontSize: 72, lineHeight: '76px', color: nearest == null ? '#3A3F70' : inTune ? 'var(--meadow)' : 'var(--sun)', textShadow: '#101126 5px 5px 0', animation: 'popIn 200ms steps(3)' }}>
            {nearest == null ? '—' : noteName(nearest, key)}
          </div>
          <div className="f-press" style={{ fontSize: 24, color: 'var(--muted)' }}>{nearest != null ? Math.floor(nearest / 12) - 1 : ''}</div>
        </div>
        {inst.writtenOffset !== 0 && (
          <div className="f-label" style={{ marginTop: -16, fontSize: 12, color: 'var(--muted)' }}>
            {nearest != null ? `WRITTEN FOR ${inst.keyLabel} · CONCERT ${noteName(nearest - inst.writtenOffset, writtenKey(0))}` : `WRITTEN FOR ${inst.keyLabel}`}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 520, height: 28, display: 'flex', gap: 4 }}>
            {['#3A1B2E', '#3A1B2E', '#3A3020', '#1E3A28', '#4CC26B', '#4CC26B', '#1E3A28', '#3A3020', '#3A1B2E', '#3A1B2E'].map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            <div style={{ position: 'absolute', left: 257 + (cents / 50) * 250, top: -8, width: 6, height: 44, background: 'var(--parchment)', boxShadow: '#101126 2px 0 0', transition: 'left 80ms steps(2)', opacity: nearest == null ? 0.2 : 1 }} />
          </div>
          <div className="f-label" style={{ width: 520, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>FLAT</span>
            <span style={{ color: inTune ? 'var(--meadow)' : 'var(--muted)' }}>{nearest == null ? 'LISTENING' : `${cents > 0 ? '+' : ''}${cents} CENTS${inTune ? ' · IN TUNE' : ''}`}</span>
            <span>SHARP</span>
          </div>
        </div>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>LEVEL</div>
          <div style={{ flex: 1, display: 'flex', gap: 4, height: 14 }}>
            {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ flex: 1, background: i < level ? (i >= 8 ? 'var(--hp)' : i >= 6 ? 'var(--sun)' : 'var(--meadow)') : '#2A2F55' }} />)}
          </div>
          <div className="f-press" style={{ padding: '4px 8px', fontSize: 11, background: status === 'on' ? 'var(--meadow)' : '#3A3F70', color: '#101126' }}>{status === 'on' ? 'READY' : 'NO MIC'}</div>
        </div>
      </div>
      <button
        onClick={() => { sfx('click'); useGame.getState().setDemo(!demo); }}
        className="f-label"
        style={{ position: 'absolute', left: 0, top: 690, width: 1440, textAlign: 'center', fontSize: 12, color: demo ? 'var(--sun)' : 'var(--muted)' }}
      >
        {demo ? '■ DEMO MODE ON: NOTES ARE SIMULATED, NO INSTRUMENT NEEDED' : '□ NO INSTRUMENT? TURN ON DEMO MODE'}
      </button>
      <div className="f-body touch-only mobile-audio-hint" style={{ position: 'absolute', left: 220, top: 720, width: 1000, textAlign: 'center', color: 'var(--soft)' }}>
        Use headphones on iPhone: the mic can send sound to the earpiece.
        <br />After returning to the game, tap once to wake the audio.
      </div>
    </MenuShell>
  );
}

export function Credits() {
  const rows: [string, string, string?][] = [
    ['MADE BY', 'RALPH · TARUN · VEPAUL · JOSHUA'],
    ['MUSIC', '"Ode to Joy" · Ludwig van Beethoven · London Symphony Orchestra, Sir Antonio Pappano'],
    ['VOICES & SFX', 'ElevenLabs'],
    ['BUILT WITH', 'Next.js · Pitchy · Web Audio · Zustand'],
    ['POWERED BY MONGODB ATLAS', 'Change streams · Search · aggregation leaderboards · TTL sessions'],
    ['MADE AT', 'ShellHacks 2026', '#FF7DB8'],
  ];
  return (
    <MenuShell title="CREDITS">
      <div style={{ position: 'absolute', left: 0, top: 236, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        {rows.map(([k, v, c], i) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: `riseIn 400ms ${200 + i * 120}ms steps(5) both` }}>
            <div className="f-label" style={{ fontSize: 14, color: c ?? 'var(--sun)', letterSpacing: '0.22em' }}>{k}</div>
            <div className={i === 0 ? 'f-press' : 'f-body'} style={{ fontSize: i === 0 ? 18 : 22, fontWeight: 500, color: 'var(--parchment)', textShadow: i === 0 ? '#101126 3px 3px 0' : undefined, maxWidth: 1100, textAlign: 'center' }}>{v}</div>
          </div>
        ))}
      </div>
    </MenuShell>
  );
}
