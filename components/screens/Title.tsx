'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { playFile, playMusic, sfx } from '@/lib/audio';
import { instrumentOf, useGame, type Screen } from '@/lib/store';
import { Arrow, Bg, FloatingNotes, Sprite, Stars } from '../ui';
import IntroMontage from './IntroMontage';
import { MobileSurface, useTouchLayout } from '../MobileSurface';

let introSeen = false;

type Item = { label: string; act: () => void; primary?: boolean; mode?: boolean };

export default function Title() {
  const touch = useTouchLayout();
  const [shot, setShot] = useState(introSeen ? 5 : 0);
  const saved = useGame((s) => s.saved);
  const startingRun = useGame(s => s.startingRun);
  const transition = useGame(s => s.transition);
  const user = useGame((s) => s.user);
  const go = useGame((s) => s.go);
  const setOverlay = useGame((s) => s.setOverlay);
  const land = useCallback(() => setShot(4), []);

  // A3 intro montage: 0 goblin · 1 serpent · 2 choir · 3 leap · 4 land + logo · 5 menu
  useEffect(() => {
    playMusic('title');
    if (introSeen) return;
    const mountedAt = performance.now();
    const skip = (event: KeyboardEvent | PointerEvent) => {
      // The gesture that mounted Title is still bubbling through the boot gate.
      if (event.timeStamp <= mountedAt || ('repeat' in event && event.repeat)) return;
      setShot(5);
    };
    const listen = window.setTimeout(() => {
      window.addEventListener('keydown', skip);
      window.addEventListener('pointerdown', skip);
    }, 0);
    return () => {
      clearTimeout(listen);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, []);
  useEffect(() => {
    if (shot === 4) {
      sfx('impact');
      void playFile('/audio/sfx/versus-slam.mp3', 0.8);
      const menu = window.setTimeout(() => setShot(5), 900);
      return () => clearTimeout(menu);
    }
    if (shot >= 5) introSeen = true;
  }, [shot]);

  const items: Item[] = useMemo(() => {
    const nav = (s: Screen) => () => go(s);
    const list: Item[] = [];
    if (saved) {
      list.push({ label: `CONTINUE · FLOOR ${saved.floor + 1}`, primary: true, act: () => { useGame.getState().continueRun(); go('map'); } });
      list.push({ label: 'NEW CLIMB', act: () => setOverlay('overwrite') });
    } else {
      list.push({ label: startingRun ? 'PREPARING CLIMB…' : 'CAMPAIGN', primary: true, act: () => { void useGame.getState().newRun().then(started => { if (started) go('instrument'); }); } });
    }
    list.splice(1, 0, { label: 'TAVERN MODE', mode: true, act: () => go('tavern', 'iris') }, { label: 'GEMS AND I', mode: true, act: () => go('training', 'iris') });
    list.push({ label: 'HOW TO PLAY', act: nav('howto') }, { label: 'MIC CHECK', act: nav('mic') }, { label: 'BOSS DEMO', act: nav('bossdemo') }, { label: 'LEADERBOARD', act: nav('leaderboard') });
    if (user) list.push({ label: 'PROFILE', act: nav('profile') });
    list.push({ label: 'CREDITS', act: nav('credits') });
    return list;
  }, [saved, user, go, setOverlay, startingRun]);

  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (shot < 5) return;
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().overlay || useGame.getState().transition || useGame.getState().startingRun || e.repeat) return;
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
      e.preventDefault();
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) { setSel((i) => (i + 1) % items.length); sfx('hover'); }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { setSel((i) => (i - 1 + items.length) % items.length); sfx('hover'); }
      if (e.key === 'Enter' || e.key === ' ') { sfx('click'); items[sel % items.length].act(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot, items, sel]);

  if (shot < 4) return <IntroMontage onLand={land} />;

  const primary = items.filter((i) => i.primary || i.mode);
  const secondary = items.filter((i) => !i.primary && !i.mode);
  const rowSize = secondary.length > 4 ? Math.ceil(secondary.length / 2) : secondary.length;
  const secondaryRows = [secondary.slice(0, rowSize), secondary.slice(rowSize)].filter((row) => row.length);

  if (touch && shot >= 5) return <MobileSurface className="mobile-home">
    <div className="mobile-home-art"><img src="/assets/logo.png" alt="Slay the Choir" /><div className="mobile-home-performer" style={{ backgroundImage: `url(${instrumentOf(useGame.getState().run).sprite})` }} /></div>
    <div className="mobile-home-content"><AccountChip /><nav aria-label="Main menu">
      <div className="mobile-home-modes">{primary.map(it => <button key={it.label} disabled={startingRun || Boolean(transition)} onClick={() => { sfx('click'); it.act(); }}>{it.label}{it.label === 'GEMS AND I' && <small>TRAINING</small>}</button>)}</div>
      <div className="mobile-home-links">{secondary.map(it => <button key={it.label} disabled={startingRun || Boolean(transition)} onClick={() => { sfx('click'); it.act(); }}>{it.label}</button>)}</div>
    </nav></div>
  </MobileSurface>;

  return (
    <div className="fill" style={{ background: '#1B1D3A' }}>
      <Bg src="/assets/bg/summit.png" />
      <Stars />
      {/* Villain silhouettes (10 Second Ninja X idea) */}
      <Sprite src="/assets/sprites/choir.png" x={-150} y={150} size={720} style={{ opacity: 0.55, filter: 'brightness(0)', animation: 'bob 6s steps(4) infinite' }} />
      <Sprite src="/assets/sprites/serpent.png" x={1130} y={60} size={420} style={{ opacity: 0.45, filter: 'brightness(0)', animation: 'bob 5s 1s steps(4) infinite' }} />
      <div className="fill" style={{ backgroundImage: 'linear-gradient(180deg, rgba(16,17,38,0) 55%, rgba(16,17,38,0.9) 100%)' }} />
      <div style={{ position: 'absolute', left: 575, top: 366, width: 280, height: 320, backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,240,190,0.45) 0%, rgba(255,230,140,0.12) 55%, rgba(255,230,140,0) 75%)', animation: 'glow 3s steps(4) infinite' }} />
      <Sprite src={instrumentOf(useGame.getState().run).sprite} x={545} y={314} size={310} style={{ animation: shot === 4 ? 'slam 500ms steps(6) both' : 'breathe 1.2s steps(2) infinite' }} />
      <img
        src="/assets/logo.png"
        alt="Slay the Choir"
        style={{ position: 'absolute', left: 430, top: -38, width: 580, animation: shot === 4 ? 'slam 600ms 200ms steps(8) both' : undefined }}
      />
      <FloatingNotes count={8} />
      {shot === 4 && <div style={{ position: 'absolute', left: 570, top: 665, width: 300, height: 22, background: '#FFF6E0', animation: 'burst 400ms steps(5) forwards', pointerEvents: 'none' }} />}

      {shot >= 5 && (
        <div style={{ position: 'absolute', left: 0, top: 606, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 17 }}>
          <div style={{ position: 'absolute', top: -16, bottom: -18, left: 150, right: 150, background: 'rgba(16,17,38,.93)', border: '3px solid #3A3F70', pointerEvents: 'none' }} />
          {primary.map((it) => {
            const i = items.indexOf(it);
            return (
              <MenuButton key={it.label} big disabled={startingRun || Boolean(transition)} active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={0}>
                {it.label}{it.label === 'GEMS AND I' && <span className="f-label" style={{ fontSize: 15, color: '#9FD8FF', marginLeft: 20 }}>TRAINING</span>}
              </MenuButton>
            );
          })}
          {saved && (
            <div className="f-label" style={{ position: 'relative', fontSize: 13, color: 'var(--sun)', animation: 'fadeIn 400ms 120ms both' }}>
              {saved.score.toLocaleString()} PTS · {saved.tips} TIPS · HP {saved.hp}
            </div>
          )}
          {secondaryRows.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44, marginTop: 4 }}>
            {row.map((it, n) => {
              const i = items.indexOf(it);
              return (
                <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
                  {n > 0 && <div style={{ width: 6, height: 6, background: 'var(--magenta)' }} />}
                  <MenuButton disabled={startingRun || Boolean(transition)} active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={80 + n * 60}>
                    {it.label === 'TAVERN MODE' && <MugIcon />} {it.label}
                  </MenuButton>
                </div>
              );
            })}
          </div>
          ))}
        </div>
      )}
      {shot >= 5 && <AccountChip />}
    </div>
  );
}

function MenuButton({ children, active, big, disabled, onClick, onHover, delay }: { children: React.ReactNode; active: boolean; big?: boolean; disabled?: boolean; onClick: () => void; onHover: () => void; delay: number }) {
  return (
    <button
      className="f-press"
      disabled={disabled}
      onMouseEnter={() => { onHover(); sfx('hover'); }}
      onClick={() => { sfx('click'); onClick(); }}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', fontSize: big ? 24 : 14, lineHeight: big ? '28px' : '18px', whiteSpace: 'nowrap',
        color: active ? '#fff' : big ? '#fff' : '#C9B8E8',
        textShadow: active ? `rgba(255,210,63,0.8) 0 0 12px, #101126 3px 3px 0` : '#101126 2px 2px 0',
        animation: `riseIn 300ms ${delay}ms steps(5) both`,
      }}
    >
      {/* Arrows float outside the label so hidden ones don't take up row width. */}
      <span style={{ position: 'absolute', right: '100%', marginRight: big ? 18 : 10, display: 'flex', opacity: active ? 1 : 0, animation: active ? 'shakeSmall 700ms steps(2) infinite' : undefined }}><Arrow size={big ? 40 : 24} /></span>
      {children}
      <span style={{ position: 'absolute', left: '100%', marginLeft: big ? 18 : 10, display: 'flex', opacity: active ? 1 : 0, animation: active ? 'shakeSmall 700ms steps(2) infinite' : undefined }}><Arrow dir="left" size={big ? 40 : 24} /></span>
    </button>
  );
}

function AccountChip() {
  const user = useGame((s) => s.user);
  const setOverlay = useGame((s) => s.setOverlay);
  if (user) {
    return (
      <div className="title-account" style={{ position: 'absolute', right: 40, top: 28, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 8px 8px', background: 'rgba(16,17,38,0.85)', border: '3px solid #3A3F70', animation: 'dropIn 300ms steps(5) both' }}>
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
    <div className="title-account" style={{ position: 'absolute', right: 40, top: 32, display: 'flex', alignItems: 'center', gap: 14, animation: 'dropIn 300ms steps(5) both' }}>
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

function MugIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges" style={{ marginRight: 10 }}><path d="M1 2H7V9H1Z" fill="#FFD23F"/><path d="M7 3H9V7H7" fill="none" stroke="#FFD23F"/><path d="M1 1H7V3H1Z" fill="#FFF6E0"/><path d="M2 4H3V8H2Z" fill="#E8A93A"/></svg>;
}
