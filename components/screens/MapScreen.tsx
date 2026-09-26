'use client';
import { useEffect, useRef, useState } from 'react';
import { playFile, playMusic, playVoice, sfx } from '@/lib/audio';
import { ACTS, ENEMIES } from '@/lib/content';
import { instrumentOf, useGame } from '@/lib/store';
import Hud from '../Hud';
import { Bg, KeyHint, Sprite } from '../ui';

/** Set by the Victory screen so the map plays the M3 path-update beat. */
export const mapFx = { reveal: false };

const NODE_Y = [715, 457, 187];

export default function MapScreen() {
  const run = useGame((s) => s.run);
  const overlay = useGame((s) => s.overlay);
  const act = Math.floor(run.floor / 3);
  const inAct = run.floor % 3; // next node index in this act
  const enemies = ENEMIES.slice(act * 3, act * 3 + 3);
  const next = ENEMIES[run.floor];
  const [reveal] = useState(() => {
    const r = mapFx.reveal;
    mapFx.reveal = false;
    return r;
  });
  const [phase, setPhase] = useState<'idle' | 'press' | 'dive' | 'versus'>('idle');
  const [revealed, setRevealed] = useState(!reveal);
  const departing = useRef(false);
  const fightTimers = useRef<number[]>([]);
  useEffect(() => () => fightTimers.current.forEach(clearTimeout), []);

  useEffect(() => playMusic('map'), []);
  useEffect(() => {
    if (!reveal) return;
    const t1 = window.setTimeout(() => sfx('stampMiss'), 300);
    const t2 = window.setTimeout(() => sfx('lockShatter'), 900);
    const t3 = window.setTimeout(() => {
      sfx('pop');
      setRevealed(true);
      useGame.getState().showToast(`Floor ${run.floor} cleared · ${run.score.toLocaleString()} pts · safe to quit`);
    }, 1400);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [reveal, run.floor, run.score]);

  const fight = () => {
    if (departing.current || phase !== 'idle' || overlay || !revealed) return;
    departing.current = true;
    sfx('click');
    setPhase('press');
    fightTimers.current = [window.setTimeout(() => { setPhase('dive'); sfx('wipe'); }, 200),
    window.setTimeout(() => {
      setPhase('versus');
      void playFile('/audio/sfx/versus-slam.mp3', 0.9);
      if (next.intro) void playVoice(next.intro, next.voice === 'choir');
    }, 400),
    window.setTimeout(() => {
      useGame.getState().startFight();
      useGame.getState().go('combat', null);
    }, 900)];
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Enter' && fight();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const nodeCenter = { x: 720, y: NODE_Y[inAct] };

  return (
    <div className="fill" style={{ background: '#101126', overflow: 'hidden' }}>
      <div
        className="fill"
        style={{
          transformOrigin: `${nodeCenter.x}px ${nodeCenter.y}px`,
          transform: phase === 'dive' || phase === 'versus' ? 'scale(3)' : phase === 'press' ? 'scale(1.03)' : 'scale(1)',
          transition: phase === 'dive' ? 'transform 200ms steps(3)' : 'transform 200ms steps(2)',
        }}
      >
        <Bg src="/assets/bg/map.png" />
        <div className="fill" style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(16,17,38,0) 40%, rgba(16,17,38,0.7) 100%)' }} />
        {reveal && [0, 1, 2].map((i) => <div key={i} aria-hidden="true" style={{ position: 'absolute', left: 709, top: inAct > 0 ? NODE_Y[inAct - 1] : 875, width: 22, height: 22, background: 'var(--sun)', transform: 'rotate(45deg)', ['--rise' as string]: `${NODE_Y[inAct] - (inAct > 0 ? NODE_Y[inAct - 1] : 875)}px`, animation: `mapUnlockFlow 300ms ${500 + i * 50}ms steps(4) both` }} />)}
        {enemies.map((e, i) => {
          const state = i < inAct ? 'cleared' : i === inAct ? 'available' : e.boss ? 'boss' : 'locked';
          const justCleared = reveal && i === inAct - 1;
          const justUnlocked = reveal && i === inAct;
          return <MapNode key={e.id} enemy={e} state={state} y={NODE_Y[i]} justCleared={justCleared} justUnlocked={justUnlocked} pressed={phase === 'press' && i === inAct} onClick={fight} />;
        })}
      </div>

      {phase === 'idle' && (
        <>
          <div className="map-act-heading" style={{ position: 'absolute', left: 40, top: 96, display: 'flex', flexDirection: 'column', gap: 6, animation: 'slideInLeft 300ms steps(5) both' }}>
            <div className="f-label" style={{ fontSize: 13, color: 'var(--sun)' }}>ACT {act + 1} OF 6</div>
            <div className="f-press" style={{ fontSize: 20, color: '#fff', textShadow: '#101126 3px 3px 0' }}>{ACTS[act].name.toUpperCase()}</div>
          </div>
          <NextFightPanel onFight={fight} reveal={reveal} />
        </>
      )}
      <Hud center={`THE CLIMB · FLOOR ${run.floor + 1} OF 18`} />
      {phase === 'versus' && <Versus />}
      <style>{`@keyframes mapUnlockFlow{0%{transform:translateY(0) rotate(45deg);opacity:0}20%{opacity:1}100%{transform:translateY(var(--rise)) rotate(45deg);opacity:0}} @keyframes mapNodeUnlock{from{filter:grayscale(1) brightness(.25)}to{filter:none}}`}</style>
    </div>
  );
}

function MapNode({ enemy, state, y, justCleared, justUnlocked, pressed, onClick }: {
  enemy: (typeof ENEMIES)[number]; state: 'cleared' | 'available' | 'locked' | 'boss'; y: number;
  justCleared: boolean; justUnlocked: boolean; pressed: boolean; onClick: () => void;
}) {
  const size = enemy.boss ? 148 : state === 'available' ? 112 : 96;
  const clip = (s: number) => `polygon(${s * 0.14}px 0, ${s * 0.86}px 0, ${s}px ${s * 0.14}px, ${s}px ${s * 0.86}px, ${s * 0.86}px ${s}px, ${s * 0.14}px ${s}px, 0 ${s * 0.86}px, 0 ${s * 0.14}px)`;
  const locked = state === 'locked' || state === 'boss';
  const fill = state === 'available' ? '#FFD23F' : state === 'cleared' ? '#3A3F70' : enemy.boss ? '#4A1D38' : '#3A3F70';
  return (
    <div style={{ position: 'absolute', left: 720 - 120, top: y - size / 2, width: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {state === 'available' && (
        <div className="f-press" style={{ position: 'absolute', top: -58, padding: '6px 12px', background: 'var(--sun)', border: '3px solid #101126', color: '#101126', fontSize: 13, animation: justUnlocked ? 'dropIn 300ms 1300ms steps(5) both, pinBob 1.2s 1600ms steps(2) infinite' : 'pinBob 1.2s steps(2) infinite' }}>
          FIGHT
        </div>
      )}
      <button
        onClick={state === 'available' ? onClick : () => sfx('denied')}
        onMouseEnter={() => state === 'available' && sfx('hover')}
        style={{
          position: 'relative', width: size, height: size, background: '#101126', clipPath: clip(size), flexShrink: 0,
          transform: pressed ? 'scale(0.9)' : undefined, filter: pressed ? 'brightness(2)' : undefined,
          boxShadow: enemy.boss ? '0 0 0 8px rgba(255,79,163,0.25)' : undefined,
          animation: state === 'boss' ? 'rattle 3s steps(1) infinite' : undefined,
          cursor: state === 'available' ? 'pointer' : 'default',
        }}
      >
        <div style={{ position: 'absolute', left: 5, top: 5, width: size - 10, height: size - 10, overflow: 'hidden', background: fill, clipPath: clip(size - 10), animation: justUnlocked ? 'mapNodeUnlock 200ms 900ms steps(3) both' : undefined }}>
          <div
            className="sprite"
            style={{
              left: -size * 0.12, top: -4, width: size * 1.15, height: size * 1.15, backgroundImage: `url(${enemy.sprite})`,
              filter: `${enemy.spriteFilter ?? ''} ${state === 'cleared' ? 'grayscale(1) brightness(0.6)' : locked ? (enemy.boss ? 'brightness(0.25) saturate(0.6)' : 'brightness(0)') : ''}`.trim() || undefined,
              transition: 'filter 300ms steps(3)',
            }}
          />
        </div>
        {state === 'cleared' && (
          <svg style={{ position: 'absolute', left: size * 0.2, top: size * 0.2, animation: justCleared ? 'stamp 300ms 300ms steps(4) both' : undefined }} width={size * 0.6} height={size * 0.6} viewBox="0 0 10 10" shapeRendering="crispEdges">
            {[0, 2, 4, 6, 8].map((v) => <rect key={`a${v}`} x={v} y={v} width="2" height="2" fill="#E8434F" />)}
            {[0, 2, 6, 8].map((v) => <rect key={`b${v}`} x={8 - v} y={v} width="2" height="2" fill="#E8434F" />)}
          </svg>
        )}
        {state === 'locked' && !justUnlocked && <LockIcon size={28} />}
        {justUnlocked && <ShatterLock />}
        {state === 'boss' && <SuperLock size={size} />}
      </button>
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 14px',
          background: 'rgba(16,17,38,0.85)', border: `3px solid ${state === 'available' ? 'var(--sun)' : enemy.boss ? 'var(--magenta)' : '#3A3F70'}`,
        }}
      >
        <div className="f-label" style={{ fontSize: 12, color: enemy.boss ? '#FF9ACB' : state === 'available' ? 'var(--sun)' : 'var(--muted)' }}>
          FLOOR {enemy.floor}{enemy.boss ? ' · BOSS' : ''}{state === 'cleared' ? ' · CLEARED' : locked ? (enemy.boss ? ' · SEALED' : ' · LOCKED') : ''}
        </div>
        {!(state === 'locked' && !enemy.boss) && <div className="f-press" style={{ fontSize: 13, color: state === 'cleared' ? 'var(--muted)' : '#fff', whiteSpace: 'nowrap' }}>{enemy.name.toUpperCase()}</div>}
      </div>
    </div>
  );
}

function LockIcon({ size }: { size: number }) {
  return (
    <svg style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }} width={size} height={size * 1.16} viewBox="0 0 6 7" shapeRendering="crispEdges">
      <rect x="1" y="0" width="4" height="1" fill="#E6E8F7" /><rect x="0" y="1" width="1" height="2" fill="#E6E8F7" /><rect x="5" y="1" width="1" height="2" fill="#E6E8F7" />
      <rect x="0" y="3" width="6" height="4" fill="#E6E8F7" /><rect x="2" y="4" width="2" height="2" fill="#3A3F70" />
    </svg>
  );
}

function ShatterLock() {
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%' }}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <div key={i} style={{ position: 'absolute', width: 8, height: 8, background: '#E6E8F7', ['--dx' as string]: `${Math.cos(a) * 70}px`, ['--dy' as string]: `${Math.sin(a) * 70}px`, animation: 'pixelDrift 500ms 900ms steps(6) both' }} />
        );
      })}
      <div style={{ animation: 'fadeOut 100ms 900ms steps(1) forwards' }}><LockIcon size={28} /></div>
    </div>
  );
}

function SuperLock({ size }: { size: number }) {
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0 }} width={size} height={size} viewBox="0 0 37 37" shapeRendering="crispEdges">
      <path d="M2 2 L35 35 M35 2 L2 35" stroke="#101126" strokeWidth="3.5" strokeDasharray="2.5 1" />
      <path d="M2 2 L35 35 M35 2 L2 35" stroke="#9AA0C8" strokeWidth="1.5" strokeDasharray="2.5 1" />
      <rect x="12" y="7" width="13" height="2" fill="#101126" /><rect x="11" y="8" width="3" height="9" fill="#101126" /><rect x="23" y="8" width="3" height="9" fill="#101126" />
      <rect x="13" y="8" width="11" height="1" fill="#E6E8F7" /><rect x="12" y="9" width="1" height="8" fill="#E6E8F7" /><rect x="24" y="9" width="1" height="8" fill="#E6E8F7" />
      <rect x="9" y="15" width="19" height="15" fill="#101126" /><rect x="10" y="16" width="17" height="13" fill="#FF4FA3" />
      <rect x="10" y="16" width="17" height="2" fill="#FF9ACB" /><rect x="10" y="27" width="17" height="2" fill="#C23A7E" />
      <rect x="17" y="20" width="3" height="3" fill="#101126" /><rect x="18" y="23" width="1" height="3" fill="#101126" />
    </svg>
  );
}

type Danger = { attempts: number; fellRate: number; accuracy: number };
let dangerCache: Record<string, Danger> | null = null;

function NextFightPanel({ onFight, reveal }: { onFight: () => void; reveal: boolean }) {
  const run = useGame((s) => s.run);
  const next = ENEMIES[run.floor];
  const [danger, setDanger] = useState(dangerCache);
  useEffect(() => {
    fetch('/api/fights')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDanger((dangerCache = d)))
      .catch(() => {});
  }, []);
  const d = danger?.[next.id];
  return (
    <div style={{ position: 'absolute', right: 40, bottom: 64, width: 392, display: 'flex', flexDirection: 'column', background: 'rgba(16,17,38,0.94)', border: '4px solid #101126', boxShadow: '#3A3F70 0 0 0 3px inset, rgba(0,0,0,0.4) 6px 6px 0', animation: `slideInRight 300ms ${reveal ? 1400 : 150}ms steps(5) both` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px 0' }}>
        <span className="f-label" style={{ fontSize: 13, color: next.boss ? '#FF7DB8' : 'var(--sun)' }}>{next.boss ? 'BOSS FIGHT' : 'NEXT FIGHT'}</span>
        <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>{run.floor + 1} / 18</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px' }}>
        <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0, overflow: 'hidden', background: next.boss ? '#3A1B2E' : '#2A2240', border: `3px solid ${next.boss ? '#6A2A4A' : '#43365F'}` }}>
          <div className="sprite" style={{ left: -12, top: -4, width: 120, height: 120, backgroundImage: `url(${next.sprite})`, animation: 'breathe 1.4s steps(2) infinite' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="f-press" style={{ fontSize: 15, color: '#fff' }}>{next.name.toUpperCase()}</div>
            <div className="f-body" style={{ fontSize: 16, color: 'var(--muted)' }}>{next.place}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[[`${next.hp} HP`, 'var(--hp)'], [`HITS ${next.damage}`, 'var(--sun)']].map(([t, c]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#2A2F55' }}>
                <div style={{ width: 8, height: 8, background: c }} />
                <span className="f-press" style={{ fontSize: 11, color: '#fff', whiteSpace: 'nowrap' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {d && d.attempts >= 3 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 24px 18px', padding: '10px 12px', background: '#1B1E3B', border: '2px solid #2A2F55', animation: 'fadeIn 300ms steps(3) both' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: 8, height: 14, background: i < Math.ceil(d.fellRate / 20) ? 'var(--hp)' : '#2A2F55' }} />)}
          </div>
          <span className="f-body" style={{ fontSize: 15, color: 'var(--soft)' }}>
            <b style={{ color: '#FF8A93' }}>{d.fellRate}%</b> of {d.attempts} climbers fell here · avg {d.accuracy}%
          </span>
        </div>
      )}
      <button onMouseEnter={() => sfx('hover')} onClick={onFight} className="pressable" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--sun)', boxShadow: 'inset 0 -4px 0 #D9A21B' }}>
        <span className="f-press" style={{ fontSize: 15, color: '#101126' }}>FIGHT</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><KeyHint k="ENTER" /></span>
      </button>
    </div>
  );
}

/** M2 step 3: diagonal split slams in, VS pops, enemy name. */
function Versus() {
  const run = useGame((s) => s.run);
  const e = ENEMIES[run.floor];
  const inst = instrumentOf(run);
  return (
    <div className="fill" style={{ zIndex: 60, background: '#101126', overflow: 'hidden' }}>
      <div className="fill" style={{ background: '#D1307E', clipPath: 'polygon(0 0, 780px 0, 640px 900px, 0 900px)', animation: 'slideInLeft 220ms steps(4) both' }} />
      <div className="fill" style={{ background: e.boss ? '#3A1B2E' : '#1E2140', clipPath: 'polygon(800px 0, 1440px 0, 1440px 900px, 660px 900px)', animation: 'slideInRight 220ms steps(4) both' }} />
      <Sprite src={inst.sprite} x={60} y={200} size={560} style={{ animation: 'slideInLeft 220ms 40ms steps(3) both' }} />
      <Sprite src={e.sprite} x={800} y={170} size={600} style={{ filter: e.spriteFilter, animation: 'slideInRight 220ms 40ms steps(3) both' }} />
      <div className="f-press" style={{ position: 'absolute', left: 620, top: 380, fontSize: 96, color: 'var(--sun)', textShadow: '#101126 8px 8px 0', animation: 'slam 220ms 100ms steps(3) both' }}>VS</div>
      <div style={{ position: 'absolute', right: 60, top: 80, textAlign: 'right', animation: 'dropIn 160ms 220ms steps(2) both' }}>
        <div className="f-label" style={{ fontSize: 14, color: e.boss ? '#FF7DB8' : 'var(--sun)' }}>FLOOR {e.floor}{e.boss ? ' · BOSS' : ''} · {e.place.toUpperCase()}</div>
        <div className="f-press" style={{ marginTop: 10, fontSize: 34, color: '#fff', textShadow: '#101126 4px 4px 0' }}>{e.name.toUpperCase()}</div>
      </div>
      <div style={{ position: 'absolute', left: 60, bottom: 80, animation: 'riseIn 160ms 220ms steps(2) both' }}>
        <div className="f-label" style={{ fontSize: 14, color: 'var(--parchment)' }}>RIFF · THE {inst.name.toUpperCase()}</div>
      </div>
    </div>
  );
}
