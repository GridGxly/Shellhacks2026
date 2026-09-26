'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { playMusic, sfx } from '@/lib/audio';
import { ACT_BONUS_SCORE, ACT_BONUS_TIPS, STATS, TIPS_PER_WIN, XP_PER_WIN } from '@/lib/config';
import { ACTS, ENEMIES } from '@/lib/content';
import { accuracy, instrumentOf, stat, useGame } from '@/lib/store';
import { useStageFit } from '@/lib/viewport';
import Hud from '../Hud';
import { Bg, FloatingNotes, Octagon, Ornament, Sprite, Stars, YellowButton } from '../ui';
import { art } from '@/lib/art';

/** Counts a number up in steps (pixel-game style, not smooth). */
function useCountUp(to: number, delay = 0, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    let lastTick = 0;
    const step = () => {
      const k = Math.min(1, Math.max(0, (performance.now() - start) / ms));
      const next = Math.round(to * Math.floor(k * 12) / 12);
      setV(next);
      if (k > 0 && performance.now() - lastTick > 70 && k < 1) {
        sfx('tick');
        lastTick = performance.now();
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else setV(to);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, ms]);
  return v;
}

function Confetti({ n = 36 }: { n?: number }) {
  const colors = ['#FFD23F', '#FF4FA3', '#6EC6FF', '#4CC26B', '#FFF6E0'];
  return (
    <div className="fill" style={{ pointerEvents: 'none', zIndex: 3 }}>
      {Array.from({ length: n }, (_, i) => (
        <svg
          key={i}
          width="18"
          height="22"
          viewBox="0 0 5 6"
          shapeRendering="crispEdges"
          style={{ position: 'absolute', left: (i * 83) % 1420, top: -30, animation: `confetti ${2.6 + (i % 5) * 0.4}s ${(i % 9) * 0.18}s steps(24) both` }}
        >
          {i % 3 === 0 ? (
            <rect x="0" y="0" width="4" height="4" fill={colors[i % colors.length]} />
          ) : (
            <g fill={colors[i % colors.length]}><rect x="3" y="0" width="1" height="5" /><rect x="0" y="3" width="4" height="3" /><rect x="4" y="0" width="1" height="2" /></g>
          )}
        </svg>
      ))}
    </div>
  );
}

function StatLine({ label, value, color = '#fff', delay }: { label: string; value: ReactNode; color?: string; delay: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '2px dashed #3A3F70', animation: `countUp 200ms ${delay}ms var(--ease-out) both` }}>
      <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <span className="f-press" style={{ fontSize: 16, color }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------- 10 Victory

export function Victory() {
  const run = useGame((s) => s.run);
  const go = useGame((s) => s.go);
  const beaten = ENEMIES[run.floor - 1];
  const next = ENEMIES[run.floor];
  const tips = useCountUp(TIPS_PER_WIN, 900);
  const xp = useCountUp(XP_PER_WIN, 1300);
  const canUpgrade = STATS.some((d) => run.tips >= d.cost);
  const actDone = run.floor % 3 === 0;
  const [leaving, setLeaving] = useState(false);
  const column = useRef<HTMLDivElement>(null);
  const fit = useStageFit(column, 110, { underHud: true });

  useEffect(() => {
    playMusic('encore');
    const coins = [0, 1, 2, 3, 4].map((i) => window.setTimeout(() => sfx('coin'), 900 + i * 80));
    const t2 = window.setTimeout(() => sfx('coin'), 1300);
    return () => [...coins, t2].forEach(clearTimeout);
  }, []);

  const proceed = () => setLeaving(true);
  useEffect(() => {
    if (!leaving) return;
    const wipe = window.setTimeout(() => go('map'), 350);
    return () => clearTimeout(wipe);
  }, [leaving, go]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Enter' && !useGame.getState().overlay && (sfx('click'), proceed());
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="fill screen-clip" style={{ background: '#101126' }}>
      <Bg src={beaten.bg} style={{ filter: `${beaten.bgFilter ?? ''} brightness(0.45) saturate(0.8)` }} />
      <div className="fill" style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 40%, rgba(255,210,63,0.18), rgba(16,17,38,0.85) 80%)' }} />
      <Confetti />
      {/* 10 Victory: no Riff here; the beaten foe fades on the right */}
      <Sprite src={beaten.sprite} x={1010} y={420} size={260} style={{ filter: `${beaten.spriteFilter ?? ''} grayscale(1) brightness(0.5)`, opacity: 0.55, transform: 'rotate(8deg)', animation: 'dissolve 800ms 500ms steps(8) forwards' }} />
      {/* The defeated foe releases tips; the count starts on the first landing. */}
      {[0, 1, 2, 3, 4].map((i) => <div key={i} aria-hidden="true" style={{ position: 'absolute', left: 1130, top: 520 + (i % 2) * 22, zIndex: 7, ['--reward-x' as string]: `${-310 - i * 9}px`, ['--reward-y' as string]: `${-188 - (i % 2) * 22}px`, animation: `victoryReward 400ms ${500 + i * 80}ms var(--ease-out) both` }}>
        <svg width="26" height="26" viewBox="0 0 8 8" shapeRendering="crispEdges"><path d="M2 0H6V1H7V2H8V6H7V7H6V8H2V7H1V6H0V2H1V1H2Z" fill="#FFD23F"/><path d="M2 2H6V6H2Z" fill="#D9A21B"/><path d="M3 1H4V6H3Z" fill="#FFF6E0"/></svg>
      </div>)}

      {/* Handhelds lay the headline beside the results so both can be drawn larger. */}
      <div ref={column} className="victory-col" style={{ position: 'absolute', left: 470, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0', width: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 5, animation: leaving ? 'victoryExit 500ms var(--ease-out) forwards' : undefined }}>
        <div className="victory-group">
        <div className="f-press" style={{ fontSize: 60, color: 'var(--sun)', textShadow: '#101126 6px 6px 0, #D1307E 10px 10px 0', animation: 'slam 450ms var(--ease-out) both' }}>VICTORY!</div>
        <div className="f-body" style={{ fontSize: 20, color: 'var(--soft)', animation: 'fadeIn 300ms 300ms both' }}>
          {beaten.name} is out of tune for good.
        </div>
        <Ornament width={420} />
        </div>
        <div className="victory-group">
        <div style={{ width: 500, padding: '18px 26px', background: 'rgba(16,17,38,0.9)', border: '4px solid #3A3F70', boxShadow: '#101126 8px 8px 0', animation: 'panelIn 400ms 400ms var(--ease-out) both' }}>
          <StatLine label="HP RESTORED" value={`${run.hp}/${stat(run, 'maxHp')}`} color="#FF8A93" delay={600} />
          <StatLine label="TIPS" value={<>+{tips} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {run.tips} total</span></>} color="var(--sun)" delay={800} />
          <StatLine label="XP" value={`+${xp}`} color="var(--sky)" delay={1200} />
          <StatLine label="SCORE" value={run.score.toLocaleString()} delay={1500} />
          <StatLine label="ACCURACY" value={`${accuracy(run.stats)}%`} color="var(--meadow)" delay={1700} />
        </div>
        {canUpgrade && (
          <div className="f-body" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(76,194,107,0.15)', border: '2px solid var(--meadow)', fontSize: 16, color: 'var(--parchment)', animation: 'popIn 300ms 2000ms var(--ease-out) both' }}>
            <span style={{ width: 10, height: 10, background: 'var(--meadow)' }} /> You can afford an upgrade. <span className="kbd-only">Click</span><span className="touch-only">Tap</span> Riff&apos;s face, top left.
          </div>
        )}
        <div style={{ marginTop: 10, animation: 'riseIn 300ms 2100ms var(--ease-out) both' }}>
          <YellowButton onClick={proceed}>PROCEED ▸</YellowButton>
        </div>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--muted)', animation: 'fadeIn 300ms 2300ms both' }}>
          {actDone ? `ACT ${run.floor / 3} CLEARED · ` : ''}NEXT: {next?.name.toUpperCase()} · CHECKPOINT SAVED
        </div>
        </div>
      </div>
      <Hud center={`FLOOR ${run.floor} OF 18 CLEARED`} pulse={canUpgrade ? 'face' : undefined} />
      <style>{`@keyframes victoryReward{0%{transform:translate(0,0) scale(.4);opacity:0}15%{opacity:1}50%{transform:translate(calc(var(--reward-x)*.5),calc(var(--reward-y)*.5 - 100px)) scale(1.1);opacity:1}90%{opacity:1}100%{transform:translate(var(--reward-x),var(--reward-y)) scale(.5);opacity:0}} @keyframes victoryExit{0%{transform:translateY(0)}30%{transform:translateY(-12px) scaleY(1.02)}100%{transform:translateY(900px) scaleY(.96)}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------- 12 Defeat

export function Loss() {
  const run = useGame((s) => s.run);
  const user = useGame((s) => s.user);
  const best = useGame((s) => s.best);
  const lossBy = useGame((s) => s.lossBy);
  const foe = ENEMIES[lossBy ?? run.floor];
  const score = useCountUp(run.score, 700, 900);
  const newBest = best && best.score === run.score && run.score > 0;

  const startingRun = useGame((s) => s.startingRun || Boolean(s.transition));
  const column = useRef<HTMLDivElement>(null);
  const fit = useStageFit(column, 130);
  useEffect(() => playMusic('none'), []);
  // Straight back to the climb with the same instrument; the title is one pause-menu tap away.
  const again = async () => {
    if (await useGame.getState().newRun()) useGame.getState().go('map');
  };

  return (
    <div className="fill screen-clip" style={{ background: '#0B0B18' }}>
      <Bg src={foe.bg} style={{ filter: `${foe.bgFilter ?? ''} grayscale(1) brightness(0.25)` }} />
      <div className="fill" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 45%, rgba(232,67,79,0.18), rgba(11,11,24,0.95) 80%)' }} />
      <Sprite src={foe.sprite} x={1000} y={300} size={foe.size} style={{ opacity: 0.35, filter: `${foe.spriteFilter ?? ''} brightness(0.4)`, animation: 'breathe 1.4s steps(2) infinite' }} />
      <div ref={column} className="loss-col" style={{ position: 'absolute', left: 0, top: fit.top, scale: fit.k === 1 ? undefined : fit.k, transformOrigin: '50% 0', width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div className="f-press" style={{ fontSize: 80, color: 'var(--hp)', textShadow: '#101126 8px 8px 0', animation: 'slam 450ms var(--ease-out) both' }}>DEFEAT</div>
        <div className="f-body" style={{ fontSize: 22, color: 'var(--soft)', animation: 'fadeIn 300ms 400ms both' }}>
          {foe.name} drowned you out on floor {foe.floor}.
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 20, animation: 'panelIn 400ms 500ms var(--ease-out) both' }}>
          {[
            ['SCORE', score.toLocaleString(), 'var(--sun)'],
            ['FLOORS', `${run.floor}/18`, '#fff'],
            ['ACCURACY', `${accuracy(run.stats)}%`, 'var(--meadow)'],
            ['CARDS', `${run.stats.cardsLanded}`, 'var(--sky)'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ width: 200, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(16,17,38,0.9)', border: '3px solid #3A3F70' }}>
              <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span>
              <span className="f-press" style={{ fontSize: 24, color: c }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="f-body" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, color: user ? 'var(--meadow)' : 'var(--muted)', animation: 'fadeIn 300ms 1600ms both' }}>
          {newBest && <span className="f-press" style={{ padding: '4px 8px', background: 'var(--sun)', color: '#101126', fontSize: 11, animation: 'pulseGold 1s steps(3) infinite' }}>NEW BEST</span>}
          {run.demo ? 'Practice run (demo mode): not ranked.' : user ? `Posted to the leaderboard as ${user.username}.` : 'Playing as guest. Sign in on the title to post scores.'}
        </div>
        <div style={{ marginTop: 18, animation: 'riseIn 300ms 1800ms var(--ease-out) both' }}>
          <YellowButton onClick={() => { if (!startingRun) void again(); }}>{startingRun ? 'PREPARING…' : 'TRY AGAIN'}</YellowButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shared cinematic clock

/** ms since mount, ticking at 12fps so everything moves in pixel-art steps. */
function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => setT(performance.now() - t0), 1000 / 12);
    return () => clearInterval(id);
  }, []);
  return t;
}
/** Plays each sound once when the clock passes its time. */
function useCues(t: number, cues: [number, () => void][]) {
  const fired = useRef(new Set<number>());
  useEffect(() => {
    cues.forEach(([at, fn], i) => {
      if (t >= at && !fired.current.has(i)) {
        fired.current.add(i);
        fn();
      }
    });
  });
}
const k01 = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const stepK = (k: number, n = 6) => Math.floor(k * n) / n;

function XStamp({ size, t, at }: { size: number; t: number; at: number }) {
  if (t < at) return null;
  const k = stepK(k01(t, at, at + 160), 3);
  return (
    <svg style={{ position: 'absolute', left: size * 0.15, top: size * 0.15, transform: `scale(${2 - k}) rotate(-8deg)`, opacity: k === 0 ? 0 : 1 }} width={size * 0.7} height={size * 0.7} viewBox="0 0 10 10">
      <path d="M1 1 L9 9 M9 1 L1 9" stroke="#101126" strokeWidth="2.2" strokeLinecap="square" />
      <path d="M1 1 L9 9 M9 1 L1 9" stroke="#E8434F" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

function Portrait({ sprite, spriteFilter, size, boss, t, dropAt, stampAt, dim, thumb }: { sprite: string; spriteFilter?: string; size: number; boss?: boolean; t: number; dropAt: number; stampAt: number; dim?: boolean; thumb?: boolean }) {
  if (t < dropAt) return <div style={{ width: size, height: size }} />;
  const drop = stepK(k01(t, dropAt, dropAt + 250), 4);
  const stamped = t >= stampAt;
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `translateY(${(1 - drop) * -60}px)` }}>
      <Octagon size={size} ring={boss ? '#FF4FA3' : '#3A3F70'} fill={boss ? '#4A1D38' : '#1E2140'}>
        <div className="sprite" style={{ left: 0, top: 0, width: size - 12, height: size - 12, backgroundImage: `url(${art(sprite, thumb ? 'thumb' : 'full')})`, filter: `${spriteFilter ?? ''} ${stamped || dim ? 'grayscale(1) brightness(0.55)' : ''}`.trim() || undefined }} />
      </Octagon>
      <XStamp size={size} t={t} at={stampAt} />
    </div>
  );
}

// ---------------------------------------------------------------- 10b Act clear (after each act boss)

export function ActClear() {
  const run = useGame((s) => s.run);
  const go = useGame((s) => s.go);
  const t = useClock();
  const actIdx = run.floor / 3 - 1; // 0-based act just cleared
  const act = ACTS[actIdx];
  const next = ACTS[actIdx + 1];
  const foes = ENEMIES.slice(actIdx * 3, actIdx * 3 + 3);
  const canUpgrade = STATS.some((d) => run.tips >= d.cost);
  const bonus = useCountUp(ACT_BONUS_SCORE, 2300, 600);
  const tips = useCountUp(TIPS_PER_WIN + ACT_BONUS_TIPS, 2600, 500);
  const ready = t >= 4300;

  useEffect(() => playMusic('encore'), []);
  useCues(t, [
    [420, () => { sfx('stampHit'); sfx('impact', 0.02); }],
    [1250, () => sfx('stampMiss')],
    [1550, () => sfx('stampMiss')],
    [1850, () => { sfx('stampMiss'); sfx('impact'); }],
    [2300, () => sfx('coin')],
    [3200, () => sfx('upgrade')],
    [3800, () => sfx('lockShatter')],
  ]);
  const proceed = () => ready && go('map');
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Enter' && !useGame.getState().overlay && proceed();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const stampK = stepK(k01(t, 420, 620), 4);
  const shake = t > 420 && t < 640 ? `translate(${Math.floor(t / 40) % 2 ? -6 : 6}px, 3px)` : undefined;
  const nameN = Math.floor(Math.max(0, t - 700) / 40);
  const fill = stepK(k01(t, 3200, 3800), 6); // cleared segment fills bottom-up
  const hop = stepK(k01(t, 3800, 4100), 3);

  return (
    <div className="fill screen-clip" style={{ background: '#101126', transform: shake }}>
      <Bg src={foes[2].bg} style={{ filter: `${foes[2].bgFilter ?? ''} brightness(0.3) saturate(0.5)` }} />
      <div className="fill" style={{ background: 'radial-gradient(ellipse 55% 55% at 42% 45%, rgba(255,210,63,0.16), rgba(16,17,38,0.92) 80%)' }} />
      {t > 400 && <Confetti n={24} />}

      {/* Title block */}
      <div style={{ position: 'absolute', left: 120, top: 110, width: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div className="f-label" style={{ fontSize: 16, color: 'var(--sun)', letterSpacing: '0.3em', opacity: t > 200 ? 1 : 0, transform: `translateY(${t > 200 ? 0 : -20}px)` }}>ACT {actIdx + 1} OF 6</div>
        <div className="f-press" style={{ fontSize: 76, lineHeight: '84px', color: 'var(--sun)', textShadow: '#101126 7px 7px 0, #D1307E 12px 12px 0', transform: `scale(${t < 420 ? 0 : 2.6 - stampK * 1.6}) rotate(-3deg)`, opacity: t < 420 ? 0 : 1 }}>CLEARED!</div>
        <div className="f-press" style={{ fontSize: 22, color: '#fff', minHeight: 30 }}>{act.name.toUpperCase().slice(0, nameN)}</div>
      </div>

      {/* Roll call of the act's three foes */}
      <div style={{ position: 'absolute', left: 120, top: 330, width: 900, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 44 }}>
        {foes.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Portrait sprite={f.sprite} spriteFilter={f.spriteFilter} size={f.boss ? 180 : 140} boss={f.boss} t={t} dropAt={1000 + i * 300} stampAt={1250 + i * 300} />
            <span className="f-label" style={{ fontSize: 12, color: f.boss ? '#FF9ACB' : 'var(--muted)', opacity: t > 1100 + i * 300 ? 1 : 0 }}>{f.boss ? 'BOSS · ' : ''}{f.name.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div style={{ position: 'absolute', left: 290, top: 590, width: 560, padding: '14px 24px', background: 'rgba(16,17,38,0.9)', border: '4px solid #3A3F70', boxShadow: '#101126 8px 8px 0', opacity: t > 2200 ? 1 : 0, transform: `translateY(${t > 2200 ? 0 : 30}px)` }}>
        <StatLine label="ACT BONUS" value={`+${bonus.toLocaleString()} PTS`} color="var(--sun)" delay={0} />
        <StatLine label="TIPS" value={<>+{tips} <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {run.tips} total</span></>} color="var(--sun)" delay={0} />
        <StatLine label="HP RESTORED" value={`${run.hp}/${stat(run, 'maxHp')}`} color="#FF8A93" delay={0} />
      </div>

      {/* Spire progress: six segments, the cleared one fills, Riff's pin hops up */}
      <div style={{ position: 'absolute', right: 110, top: 120, width: 250, height: 640, opacity: t > 3000 ? 1 : 0, transition: 'opacity 200ms steps(3)' }}>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 12 }}>THE SPIRE</div>
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 8 }}>
          {ACTS.map((a, i) => {
            const done = i < actIdx || (i === actIdx && fill >= 1);
            const filling = i === actIdx;
            const unsealed = i === actIdx + 1 && t >= 3800;
            const here = i === actIdx + 1 && hop >= 1;
            return (
              <div key={a.n} style={{ position: 'relative', height: 84, background: '#1B1E3B', border: `3px solid ${here ? 'var(--sun)' : done ? '#6B5A1E' : '#2A2F55'}`, overflow: 'hidden', animation: unsealed && t < 4000 ? 'shakeSmall 200ms steps(2)' : undefined }}>
                <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: `${(i < actIdx ? 1 : filling ? fill : 0) * 100}%`, background: 'linear-gradient(180deg, #FFD23F, #C9901B)', opacity: 0.35 }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="f-label" style={{ fontSize: 10, color: 'var(--muted)' }}>ACT {a.n}</span>
                    <span className="f-press" style={{ fontSize: 10, color: done || here ? '#fff' : '#6B6F8E' }}>{a.name.toUpperCase()}</span>
                  </div>
                  <span className="f-press" style={{ fontSize: 14, color: done ? 'var(--sun)' : unsealed ? 'var(--meadow)' : '#3A3F70' }}>{done ? '★' : unsealed ? '▲' : '■'}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Riff's pin */}
        <div style={{ position: 'absolute', left: -46, top: 28 + (5 - actIdx - hop) * 92 + 22, width: 36, height: 36, overflow: 'hidden', background: '#2A2F55', border: '3px solid var(--sun)' }}>
          <div className="sprite" style={{ left: -48, top: 0, width: 130, height: 130, backgroundImage: `url(${art(instrumentOf(run).sprite)})`, backgroundPosition: '50% 0' }} />
        </div>
      </div>

      {/* Call to action */}
      <div className="ui-b ui-soft" style={{ position: 'absolute', left: 120, top: 790, width: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: ready ? 1 : 0, transform: `translateY(${ready ? 0 : 20}px)` }}>
        <YellowButton onClick={proceed}>CLIMB TO ACT {actIdx + 2} ▸</YellowButton>
        <span className="f-label" style={{ fontSize: 11, color: 'var(--muted)' }}>{next ? `${next.name.toUpperCase()} · UNSEALED` : ''}<span className="desk-only">{canUpgrade ? ' · SPEND TIPS: CLICK RIFF, TOP LEFT' : ''}</span> · CHECKPOINT SAVED</span>
      </div>
      {/* Phones: the taller HUD would crowd the headline; the rewards panel already shows tips and HP. */}
      <div className="desk-only"><Hud center={`ACT ${actIdx + 1} CLEARED`} pulse={ready && canUpgrade ? 'face' : undefined} /></div>
    </div>
  );
}

// ---------------------------------------------------------------- 13 Final (all six bosses down)

export function FinalVictory() {
  const run = useGame((s) => s.run);
  const user = useGame((s) => s.user);
  const inst = instrumentOf(run);
  const t = useClock();
  const [rank, setRank] = useState<number | null>(null);
  const score = useCountUp(run.score, 4900, 1400);
  const [mins] = useState(() => Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)));
  const ROLL = 1500; // roll call starts
  const STAMP_GAP = 85;
  const rollEnd = ROLL + 18 * STAMP_GAP + 300;
  const SING = rollEnd + 300;

  useEffect(() => playMusic('final'), []);
  useEffect(() => {
    if (!user) return;
    const id = window.setTimeout(() => {
      fetch('/api/leaderboard').then((r) => (r.ok ? r.json() : null)).then((d) => d?.me && setRank(d.me.rank)).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [user]);
  useCues(t, [
    ...ENEMIES.map((_, i): [number, () => void] => [ROLL + 250 + i * STAMP_GAP, () => sfx(i % 3 === 2 ? 'stampMiss' : 'tick')]),
    [SING, () => { sfx('stampHit'); sfx('impact', 0.03); }],
    [6600, () => sfx('upgrade')],
  ]);
  const again = () => {
    useGame.getState().go('title');
  };

  const opening = t < ROLL;
  const rollOut = stepK(k01(t, SING - 200, SING + 200), 4);
  const typed = 'THE SPIRE FALLS SILENT.'.slice(0, Math.floor(Math.max(0, t - 300) / 45));
  const sing = t >= SING;

  return (
    <div className="fill screen-clip" style={{ background: '#101126' }}>
      <Bg src="/assets/bg/summit.png" style={{ filter: `brightness(${sing ? 0.75 : 0.2}) saturate(${sing ? 1 : 0.3})`, transition: 'filter 500ms steps(5)' }} />
      {sing && <Stars />}
      {sing && <div style={{ position: 'absolute', left: 520, top: 0, width: 400, height: 900, background: 'linear-gradient(180deg, rgba(255,230,150,0.35), rgba(255,230,150,0))', clipPath: 'polygon(35% 0, 65% 0, 100% 100%, 0 100%)', animation: 'fadeIn 600ms var(--ease-out) both' }} />}
      {sing && <FloatingNotes count={16} />}
      {sing && <Confetti n={48} />}
      {sing && t < SING + 120 && <div className="fill" style={{ background: '#FFF6E0', zIndex: 30 }} />}

      {/* Beat 1: silence */}
      {opening && (
        <div className="f-press" style={{ position: 'absolute', left: 0, top: 410, width: 1440, textAlign: 'center', fontSize: 30, color: '#C9CDE8', textShadow: '#101126 4px 4px 0' }}>
          {typed}<span style={{ color: 'var(--magenta)' }}>▌</span>
        </div>
      )}

      {/* Beat 2: roll call of all 18, stamped in climb order */}
      {!opening && (
        <div style={{ position: 'absolute', left: 0, top: 150, width: 1440, display: 'flex', justifyContent: 'center', gap: 22, opacity: 1 - rollOut, transform: `translateY(${-rollOut * 80}px)` }}>
          {ACTS.map((a, ai) => (
            <div key={a.n} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 12 }}>
              <span className="f-label" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>ACT {a.n}</span>
              {ENEMIES.slice(ai * 3, ai * 3 + 3).map((e, j) => {
                const i = ai * 3 + j;
                return <Portrait key={e.id} thumb sprite={e.sprite} spriteFilter={e.spriteFilter} size={e.boss ? 150 : 118} boss={e.boss} t={t} dropAt={ROLL + i * 40} stampAt={ROLL + 250 + i * STAMP_GAP} />;
              })}
            </div>
          ))}
        </div>
      )}

      {/* Beat 3: it sings */}
      {sing && (
        <>
          <Sprite src={inst.id === 'trumpet' ? '/assets/sprites/riff-leap.png' : inst.sprite} x={560} y={430} size={320} style={{ animation: 'dropIn 500ms var(--ease-out) both, bob 900ms 600ms steps(2) infinite' }} />
          <div style={{ position: 'absolute', left: 0, top: 90, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 5 }}>
            <div className="f-label" style={{ fontSize: 14, color: 'var(--sun)', animation: 'fadeIn 300ms both' }}>…THEN IT SINGS</div>
            <div className="f-press" style={{ fontSize: 58, color: '#fff', textShadow: '#101126 6px 6px 0, #D1307E 10px 10px 0', animation: 'slam 500ms 100ms var(--ease-out) both' }}>ENCORE LANDED</div>
            <div className="f-body" style={{ fontSize: 20, color: 'var(--soft)', animation: 'fadeIn 300ms 500ms both' }}>All 18 floors. Six bosses. One {inst.name.toLowerCase()}.</div>
          </div>
          <div style={{ position: 'absolute', left: 0, top: 290, width: 1440, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '14px 26px', background: 'rgba(16,17,38,0.88)', border: '4px solid var(--sun)', animation: 'panelIn 400ms 700ms var(--ease-out) both' }}>
              <span className="f-label" style={{ fontSize: 13, color: 'var(--muted)' }}>FINAL SCORE</span>
              <span className="f-press" style={{ fontSize: 36, color: 'var(--sun)', minWidth: 230 }}>{score.toLocaleString()}</span>
              <span className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>{accuracy(run.stats)}% · {run.stats.encoresLanded} ENCORES · {mins} MIN</span>
            </div>
          </div>
          {t > 6500 && (
            <div className="f-press" style={{ position: 'absolute', left: 980, top: 470, zIndex: 6, padding: '12px 16px', fontSize: rank ? 26 : 14, color: '#101126', background: rank ? 'var(--sun)' : 'var(--parchment)', border: '4px solid #101126', boxShadow: '#D1307E 6px 6px 0', animation: 'stamp 360ms var(--ease-out) both' }}>
              {rank ? `#${rank} ON THE BOARD` : user ? 'SCORE POSTED' : 'SIGN IN TO RANK'}
            </div>
          )}
          <div className="ui-b ui-soft" style={{ position: 'absolute', left: 0, bottom: 'calc(48px - var(--rail-b))', width: 1440, display: 'flex', justifyContent: 'center', gap: 18, zIndex: 6, opacity: t > 7000 ? 1 : 0 }}>
            <YellowButton onClick={again}>START NEW ADVENTURE</YellowButton>
            <YellowButton small onClick={() => useGame.getState().go('leaderboard')} style={{ background: '#2A2F55', color: '#fff', boxShadow: '#101126 6px 6px 0' }}>LEADERBOARD</YellowButton>
          </div>
        </>
      )}
    </div>
  );
}
