'use client';
import { useEffect, useMemo, useState } from 'react';
import { playFile, playMusic, sfx } from '@/lib/audio';
import { instrumentOf, useGame, type Screen } from '@/lib/store';
import { Arrow, Bg, FloatingNotes, Sprite, Stars } from '../ui';

let introSeen = false;

type Item = { label: string; act: () => void; primary?: boolean };

export default function Title() {
  const [shot, setShot] = useState(introSeen ? 5 : 0);
  const saved = useGame((s) => s.saved);
  const user = useGame((s) => s.user);
  const go = useGame((s) => s.go);
  const setOverlay = useGame((s) => s.setOverlay);

  // A3 intro montage: 0 goblin · 1 serpent · 2 choir · 3 leap · 4 land + logo · 5 menu
  useEffect(() => {
    playMusic('title');
    if (introSeen) return;
    // IntroFilm runs 0–7.4s, then the logo lands (shot 4), then the menu (shot 5).
    const ids = [window.setTimeout(() => setShot(4), INTRO_MS), window.setTimeout(() => setShot(5), INTRO_MS + 1100)];
    const skip = () => setShot(5);
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      ids.forEach(clearTimeout);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, []);
  useEffect(() => {
    if (shot === 4) playFile('/audio/sfx/versus-slam.mp3', 0.8);
    if (shot >= 5) introSeen = true;
  }, [shot]);

  const items: Item[] = useMemo(() => {
    const nav = (s: Screen) => () => go(s);
    const list: Item[] = [];
    if (saved) {
      list.push({ label: `CONTINUE · FLOOR ${saved.floor + 1}`, primary: true, act: () => { useGame.getState().continueRun(); go('map'); } });
      list.push({ label: 'NEW CLIMB', act: () => setOverlay('overwrite') });
    } else {
      list.push({ label: 'BEGIN THE CLIMB', primary: true, act: () => { useGame.getState().newRun(); go('instrument'); } });
    }
    list.push({ label: 'HOW TO PLAY', act: nav('howto') }, { label: 'MIC CHECK', act: nav('mic') }, { label: 'PITCH LAB', act: nav('lab') }, { label: 'BOSS DEMO', act: nav('bossdemo') }, { label: 'LEADERBOARD', act: nav('leaderboard') });
    if (user) list.push({ label: 'PROFILE', act: nav('profile') });
    list.push({ label: 'CREDITS', act: nav('credits') });
    return list;
  }, [saved, user, go, setOverlay]);

  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (shot < 5) return;
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().overlay) return;
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) { setSel((i) => (i + 1) % items.length); sfx('hover'); }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { setSel((i) => (i - 1 + items.length) % items.length); sfx('hover'); }
      if (e.key === 'Enter' || e.key === ' ') { sfx('click'); items[sel].act(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot, items, sel]);

  if (shot < 4) return <IntroFilm />;

  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);

  return (
    <div className="fill" style={{ background: '#1B1D3A' }}>
      <Bg src="/assets/bg/summit.png" />
      <Stars />
      {/* Villain silhouettes (10 Second Ninja X idea) */}
      <Sprite src="/assets/sprites/choir.png" x={-150} y={150} size={720} style={{ opacity: 0.55, filter: 'brightness(0)', animation: 'bob 6s steps(4) infinite' }} />
      <Sprite src="/assets/sprites/serpent.png" x={1130} y={60} size={420} style={{ opacity: 0.45, filter: 'brightness(0)', animation: 'bob 5s 1s steps(4) infinite' }} />
      <div className="fill" style={{ backgroundImage: 'linear-gradient(180deg, rgba(16,17,38,0) 55%, rgba(16,17,38,0.9) 100%)' }} />
      <div style={{ position: 'absolute', left: 575, top: 366, width: 280, height: 320, backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,240,190,0.45) 0%, rgba(255,230,140,0.12) 55%, rgba(255,230,140,0) 75%)', animation: 'glow 3s steps(4) infinite' }} />
      <Sprite src={instrumentOf(useGame.getState().run).sprite} x={545} y={356} size={340} style={{ animation: shot === 4 ? 'slam 500ms steps(6) both' : 'breathe 1.2s steps(2) infinite' }} />
      <img
        src="/assets/logo.png"
        alt="Slay the Choir"
        style={{ position: 'absolute', left: 380, top: 18, width: 680, animation: shot === 4 ? 'slam 600ms 200ms steps(8) both' : undefined }}
      />
      <FloatingNotes count={8} />
      {shot === 4 && <div className="fill" style={{ background: '#FFF6E0', animation: 'fadeOut 500ms steps(5) forwards', pointerEvents: 'none' }} />}

      {shot >= 5 && (
        <div style={{ position: 'absolute', left: 0, top: 700, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {primary.map((it) => {
            const i = items.indexOf(it);
            return (
              <MenuButton key={it.label} big active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={0}>
                {it.label}
              </MenuButton>
            );
          })}
          {saved && (
            <div className="f-label" style={{ fontSize: 13, color: 'var(--sun)', animation: 'fadeIn 400ms 120ms both' }}>
              {saved.score.toLocaleString()} PTS · {saved.tips} TIPS · HP {saved.hp}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 4 }}>
            {secondary.map((it, n) => {
              const i = items.indexOf(it);
              return (
                <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  {n > 0 && <div style={{ width: 6, height: 6, background: 'var(--magenta)' }} />}
                  <MenuButton active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={80 + n * 60}>
                    {it.label}
                  </MenuButton>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {shot >= 5 && <AccountChip />}
      <div className="f-label" style={{ position: 'absolute', left: 40, bottom: 28, fontSize: 12, color: '#9AA0C8' }}>SHELLHACKS 2026 · v1.0</div>
    </div>
  );
}

function MenuButton({ children, active, big, onClick, onHover, delay }: { children: React.ReactNode; active: boolean; big?: boolean; onClick: () => void; onHover: () => void; delay: number }) {
  return (
    <button
      className="f-press"
      onMouseEnter={() => { onHover(); sfx('hover'); }}
      onClick={() => { sfx('click'); onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 18, fontSize: big ? 24 : 14, lineHeight: big ? '28px' : '18px',
        color: active ? '#fff' : big ? '#fff' : '#C9B8E8',
        textShadow: active ? `rgba(255,210,63,0.8) 0 0 12px, #101126 3px 3px 0` : '#101126 2px 2px 0',
        animation: `riseIn 300ms ${delay}ms steps(5) both`,
      }}
    >
      <span style={{ opacity: active ? 1 : 0, animation: active ? 'shakeSmall 700ms steps(2) infinite' : undefined }}><Arrow size={big ? 40 : 24} /></span>
      {children}
      <span style={{ opacity: active ? 1 : 0, animation: active ? 'shakeSmall 700ms steps(2) infinite' : undefined }}><Arrow dir="left" size={big ? 40 : 24} /></span>
    </button>
  );
}

function AccountChip() {
  const user = useGame((s) => s.user);
  const setOverlay = useGame((s) => s.setOverlay);
  if (user) {
    return (
      <div style={{ position: 'absolute', right: 40, top: 28, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 8px 8px', background: 'rgba(16,17,38,0.85)', border: '3px solid #3A3F70', animation: 'dropIn 300ms steps(5) both' }}>
        <div style={{ position: 'relative', width: 44, height: 44, overflow: 'hidden', background: '#2A2F55', border: '3px solid var(--sun)' }}>
          <div className="sprite" style={{ left: -68, top: 2, width: 150, height: 150, backgroundImage: 'url(/assets/sprites/riff-trumpet.png)', backgroundPosition: '50% 0' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="f-press" style={{ fontSize: 13, color: '#fff' }}>{user.username.toUpperCase()}</div>
          <div className="f-label" style={{ fontSize: 11, color: 'var(--sun)' }}>LV {user.level}{user.rank ? ` · RANK #${user.rank}` : ''}</div>
        </div>
        <div style={{ width: 2, height: 32, background: '#3A3F70', margin: '0 4px' }} />
        <button
          className="f-label"
          style={{ fontSize: 11, color: 'var(--muted)' }}
          onClick={async () => {
            sfx('back');
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
            useGame.getState().setUser(null);
          }}
        >
          SIGN OUT
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', right: 40, top: 32, display: 'flex', alignItems: 'center', gap: 14, animation: 'dropIn 300ms steps(5) both' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>PLAYING AS GUEST</div>
        <div className="f-body" style={{ fontSize: 14, color: 'var(--soft)' }}>Sign in to save runs + get ranked</div>
      </div>
      <button
        className="f-press hoverable pressable"
        onMouseEnter={() => sfx('hover')}
        onClick={() => { sfx('click'); setOverlay('signin'); }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 12, color: 'var(--sun)', background: 'rgba(16,17,38,0.85)', border: '3px solid var(--sun)', boxShadow: '#D1307E 4px 4px 0' }}
      >
        <svg width="16" height="16" viewBox="0 0 8 8" shapeRendering="crispEdges"><rect x="2" y="0" width="4" height="4" fill="#FFD23F" /><rect x="0" y="5" width="8" height="3" fill="#FFD23F" /><rect x="1" y="4" width="6" height="1" fill="#FFD23F" /></svg>
        SIGN IN
      </button>
    </div>
  );
}


// ---------------------------------------------------------------- A3 intro film
// One clock, five beats, 12fps like the sprites:
//   A 0.0–2.6  The spire. Camera tilts up; every note in the world drifts up into the choir.
//   B 2.6–3.8  Silence. One grey note falls and shatters.
//   C 3.8–5.6  A spotlight. Riff steps out of the dark and blows; the shockwave pushes the notes back out.
//   D 5.6–6.8  Smash cuts: goblin, serpent, choir. The fights ahead.
//   E 6.8–7.4  Riff leaps up the screen into a whiteout, and the logo lands.
export const INTRO_MS = 7400;
const FPS = 12;

function useFilmClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => setT(performance.now() - t0), 1000 / FPS);
    return () => clearInterval(id);
  }, []);
  return t;
}

/** Fire a callback once when the clock passes `at`. */
function useCue(t: number, at: number, fn: () => void) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && t >= at) {
      setDone(true);
      fn();
    }
  }, [t, at, done, fn]);
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const step = (k: number, n = 6) => Math.floor(k * n) / n; // stepped easing

function Typewriter({ text, t, start, cps = 26, style }: { text: string; t: number; start: number; cps?: number; style?: React.CSSProperties }) {
  const n = Math.max(0, Math.floor(((t - start) / 1000) * cps));
  if (t < start) return null;
  return (
    <div className="f-press" style={{ position: 'absolute', left: 0, width: 1440, textAlign: 'center', fontSize: 24, color: '#FFF6E0', textShadow: '#101126 3px 3px 0', letterSpacing: '0.04em', ...style }}>
      {text.slice(0, n)}
      <span style={{ opacity: n < text.length || Math.floor(t / 300) % 2 ? 1 : 0, color: 'var(--magenta)' }}>▌</span>
    </div>
  );
}

const NOTE_COLORS = ['#FFD23F', '#FF7DB8', '#9FD8FF', '#4CC26B', '#FFF6E0'];
function PixelNote({ x, y, c, s = 1, style }: { x: number; y: number; c: string; s?: number; style?: React.CSSProperties }) {
  return (
    <svg width={20 * s} height={24 * s} viewBox="0 0 5 6" shapeRendering="crispEdges" style={{ position: 'absolute', left: x, top: y, ...style }}>
      <rect x="3" y="0" width="1" height="5" fill={c} /><rect x="0" y="3" width="4" height="3" fill={c} /><rect x="4" y="0" width="1" height="2" fill={c} />
    </svg>
  );
}

function IntroFilm() {
  const t = useFilmClock();
  const impact = useMemo(() => () => sfx('impact'), []);
  const blow = useMemo(() => () => { sfx('zap'); sfx('impact', 0.05); }, []);
  const light = useMemo(() => () => sfx('stampMiss'), []);
  const shatter = useMemo(() => () => sfx('lockShatter'), []);
  useCue(t, 3350, shatter);
  useCue(t, 3850, light);
  useCue(t, 4900, blow);
  useCue(t, 5600, impact);
  useCue(t, 6000, impact);
  useCue(t, 6400, impact);
  useCue(t, 6850, blow);

  let beat: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
  if (t >= 2600) beat = 'B';
  if (t >= 3800) beat = 'C';
  if (t >= 5600) beat = 'D';
  if (t >= 6800) beat = 'E';
  const shake = (at: number, ms = 240) => (t >= at && t < at + ms ? `translate(${(Math.floor(t / 40) % 2 ? -1 : 1) * 8}px, ${(Math.floor(t / 60) % 2 ? 1 : -1) * 5}px)` : undefined);

  return (
    <div className="fill" style={{ background: '#07070f', overflow: 'hidden' }}>
      {beat === 'A' && <BeatSpire t={t} />}
      {beat === 'B' && <BeatSilence t={t} />}
      {beat === 'C' && <div className="fill" style={{ transform: shake(4900, 320) }}><BeatHorn t={t} /></div>}
      {beat === 'D' && <BeatCuts t={t} shake={shake} />}
      {beat === 'E' && <BeatLeap t={t} />}

      {/* letterbox bars close in slightly during the cuts, open for the leap */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1440, height: beat === 'D' ? 110 : 80, background: '#07070f', zIndex: 20 }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: 1440, height: beat === 'D' ? 110 : 80, background: '#07070f', zIndex: 20 }} />
      <div className="f-label" style={{ position: 'absolute', right: 40, bottom: 30, zIndex: 21, fontSize: 12, color: '#6B6F8E' }}>
        <span className="kbd-only">ANY KEY TO SKIP</span>
        <span className="touch-only">TAP TO SKIP</span>
      </div>
      {/* film progress ticks */}
      <div style={{ position: 'absolute', left: 40, bottom: 34, zIndex: 21, display: 'flex', gap: 6 }}>
        {['A', 'B', 'C', 'D', 'E'].map((b) => <div key={b} style={{ width: 18, height: 6, background: b <= beat ? 'var(--magenta)' : '#2A2F55' }} />)}
      </div>
    </div>
  );
}

function BeatSpire({ t }: { t: number }) {
  const k = step(seg(t, 0, 2400), 14);
  // Tall camera move: the spire image is scaled up and panned from its base to its peak.
  const panY = -520 + k * 520;
  const choirGlow = seg(t, 600, 2400);
  return (
    <div className="fill">
      <div style={{ position: 'absolute', left: 0, top: panY, width: 1440, height: 1420 }}>
        <Bg src="/assets/bg/spire.png" style={{ left: -120, top: 0, width: 1680, height: 1420, filter: 'brightness(0.7) saturate(0.9)' }} />
        {/* the choir at the peak, lit from inside */}
        <div style={{ position: 'absolute', left: 520, top: 40, width: 400, height: 400, background: `radial-gradient(circle, rgba(255,79,163,${0.15 + choirGlow * 0.45}), rgba(255,79,163,0) 65%)` }} />
        <Sprite src="/assets/sprites/choir.png" x={560} y={60} size={320} style={{ filter: `brightness(${0.15 + choirGlow * 0.5}) saturate(1.4)`, animation: 'bob 1.4s steps(2) infinite' }} />
        {/* notes rising from the valley into the choir */}
        {Array.from({ length: 22 }, (_, i) => {
          const born = (i % 11) * 180;
          const life = seg(t, born, born + 1500);
          if (life <= 0 || life >= 1) return null;
          const sx = 120 + ((i * 197) % 1200);
          const sy = 1300 - ((i * 61) % 160);
          const ex = 720, ey = 230;
          const p = step(life, 8);
          return <PixelNote key={i} x={sx + (ex - sx) * p * p} y={sy + (ey - sy) * p} c={NOTE_COLORS[i % 5]} s={1.4 - p * 0.8} style={{ opacity: 1 - p * 0.3 }} />;
        })}
      </div>
      <div className="fill" style={{ background: 'linear-gradient(180deg, rgba(7,7,15,0.2), rgba(7,7,15,0) 40%, rgba(7,7,15,0.7))' }} />
      <div className="f-label" style={{ position: 'absolute', left: 0, top: 118, width: 1440, textAlign: 'center', fontSize: 13, color: 'var(--magenta)', opacity: t > 300 ? 1 : 0 }}>THE SPIRE · TOP FLOOR</div>
      <Typewriter t={t} start={700} text="THE CHOIR STOLE EVERY SONG." style={{ top: 770 }} />
    </div>
  );
}

function BeatSilence({ t }: { t: number }) {
  const fall = step(seg(t, 2700, 3350), 8);
  const broke = t >= 3350;
  return (
    <div className="fill" style={{ background: '#07070f' }}>
      {!broke && <PixelNote x={706} y={200 + fall * 330} c="#6B6F8E" s={1.6} />}
      {broke && (
        <div style={{ position: 'absolute', left: 720, top: 560 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = Math.PI + (i / 9) * Math.PI;
            return <div key={i} style={{ position: 'absolute', width: 6, height: 6, background: '#6B6F8E', ['--dx' as string]: `${Math.cos(a) * 90}px`, ['--dy' as string]: `${Math.sin(a) * 60}px`, animation: 'pixelDrift 400ms steps(5) forwards' }} />;
          })}
          <div style={{ position: 'absolute', left: -160, top: 8, width: 320, height: 3, background: '#2A2F55' }} />
        </div>
      )}
      <Typewriter t={t} start={2750} text="THE WORLD WENT QUIET." cps={20} style={{ top: 680, color: '#9AA0C8' }} />
    </div>
  );
}

function BeatHorn({ t }: { t: number }) {
  const lit = t >= 3850;
  const reveal = step(seg(t, 3900, 4600), 5); // silhouette -> full colour
  const blown = t >= 4900;
  const ring = seg(t, 4900, 5400);
  return (
    <div className="fill">
      <Bg src="/assets/bg/summit.png" style={{ filter: `brightness(${lit ? 0.18 + reveal * 0.25 : 0.05}) saturate(0.6)` }} />
      {lit && <div style={{ position: 'absolute', left: 470, top: 0, width: 500, height: 900, background: 'linear-gradient(180deg, rgba(255,240,190,0.45), rgba(255,240,190,0.08))', clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)' }} />}
      {lit && <div style={{ position: 'absolute', left: 540, top: 700, width: 360, height: 44, borderRadius: '50%', background: 'rgba(255,240,190,0.35)' }} />}
      <Sprite
        src={blown ? '/assets/sprites/riff-attack.png' : '/assets/sprites/riff-trumpet.png'}
        x={520}
        y={300}
        size={420}
        style={{ filter: `brightness(${lit ? reveal : 0})`, transform: blown && t < 5050 ? 'translateX(-14px)' : undefined }}
      />
      {blown && (
        <>
          {/* shockwave: stepped ring out of the bell */}
          <div style={{ position: 'absolute', left: 900 - ring * 420, top: 470 - ring * 420, width: ring * 840, height: ring * 840, borderRadius: '50%', border: `${Math.max(2, 14 - ring * 12)}px solid rgba(255,210,63,${1 - ring})` }} />
          {/* the stolen notes come back out */}
          {Array.from({ length: 16 }, (_, i) => {
            const p = step(seg(t, 4900 + (i % 4) * 60, 5500 + (i % 4) * 60), 7);
            const a = -0.9 + (i / 15) * 1.8;
            return <PixelNote key={i} x={900 + Math.cos(a) * p * 620} y={470 + Math.sin(a) * p * 420} c={NOTE_COLORS[i % 5]} s={1.2 + (i % 3) * 0.3} style={{ opacity: 1 - p * 0.4 }} />;
          })}
        </>
      )}
      <Typewriter t={t} start={4000} text="ONE KID STILL HAD A HORN." style={{ top: 780 }} />
    </div>
  );
}

const CUTS = [
  { at: 5600, sprite: '/assets/sprites/goblin.png', name: 'SNARE GOBLIN', bg: '#C9901B', size: 520 },
  { at: 6000, sprite: '/assets/sprites/serpent.png', name: 'BRASS SERPENT', bg: '#2F7EC4', size: 540 },
  { at: 6400, sprite: '/assets/sprites/choir.png', name: 'THE HOLLOW CHOIR', bg: '#C23A7E', size: 600 },
];

function BeatCuts({ t, shake }: { t: number; shake: (at: number, ms?: number) => string | undefined }) {
  const c = [...CUTS].reverse().find((x) => t >= x.at)!;
  const i = CUTS.indexOf(c);
  const local = t - c.at;
  const slide = step(seg(local, 0, 160), 3);
  return (
    <div className="fill" style={{ background: c.bg, transform: shake(c.at, 200) }}>
      {/* speed stripes */}
      {Array.from({ length: 9 }, (_, n) => (
        <div key={n} style={{ position: 'absolute', left: -200 + ((n * 173 + local * 3) % 1800), top: 120 + n * 76, width: 260 + (n % 3) * 120, height: 10, background: 'rgba(16,17,38,0.25)' }} />
      ))}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1440, height: 900, background: '#101126', clipPath: 'polygon(0 0, 46% 0, 34% 100%, 0 100%)' }} />
      <Sprite src={c.sprite} x={1440 - c.size - 60 + (1 - slide) * 400} y={900 - c.size - 100} size={c.size} />
      <div className="f-label" style={{ position: 'absolute', left: 80, top: 330, fontSize: 16, color: 'var(--sun)' }}>FLOOR {i + 1}{i === 2 ? ' · BOSS' : ''}</div>
      <div className="f-press" style={{ position: 'absolute', left: 80 - (1 - slide) * 300, top: 370, width: 560, fontSize: 44, lineHeight: '56px', color: '#FFF6E0', textShadow: '#D1307E 5px 5px 0' }}>{c.name}</div>
      {local < 70 && <div className="fill" style={{ background: '#fff' }} />}
    </div>
  );
}

function BeatLeap({ t }: { t: number }) {
  const p = step(seg(t, 6800, 7300), 6);
  const white = seg(t, 7150, 7400);
  return (
    <div className="fill" style={{ background: '#1B1D3A' }}>
      <Bg src="/assets/bg/summit.png" style={{ filter: 'brightness(0.6)', transform: `translateY(${p * 160}px)` }} />
      {Array.from({ length: 14 }, (_, n) => (
        <div key={n} style={{ position: 'absolute', left: 80 + n * 97, top: 900 - ((n * 211 + t * 2.4) % 1100), width: 6, height: 140 + (n % 4) * 60, background: 'rgba(255,246,224,0.35)' }} />
      ))}
      <Sprite src="/assets/sprites/riff-leap.png" x={520} y={760 - p * 900} size={420} />
      <div className="fill" style={{ background: '#FFF6E0', opacity: step(white, 4) }} />
    </div>
  );
}
