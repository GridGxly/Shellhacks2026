'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { playFile, playMusic, sfx } from '@/lib/audio';
import { instrumentOf, useGame, type Screen } from '@/lib/store';
import { Bg, Scene, Sprite } from '../ui';
import IntroMontage from './IntroMontage';
import { enterFullscreen, useFullscreenOffer } from '@/lib/viewport';
import { art } from '@/lib/art';
import './title.css';

let introSeen = false;
/** ms from shot 4 until Riff's feet hit the summit. */
const LAND_MS = 340;

type Item = { label: string; act: () => void; note?: string };

/**
 * S1 / S2 home: the modes stack on the left under the logo, the utilities sit
 * under them (desktop) or on the right rail (phones), and Riff stands alone on
 * the summit. Idle, the only thing that moves is Riff's breathing.
 */
export default function Title() {
  const fullscreen = useFullscreenOffer();
  const [shot, setShot] = useState(introSeen ? 5 : 0);
  const saved = useGame((s) => s.saved);
  const startingRun = useGame((s) => s.startingRun);
  const transition = useGame((s) => s.transition);
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
      // Riff falls back in from the intro's leap: the hit lands with his feet.
      sfx('impact', LAND_MS / 1000);
      const slam = window.setTimeout(() => void playFile('/audio/sfx/versus-slam.mp3', 0.8), LAND_MS);
      const menu = window.setTimeout(() => setShot(5), 1050);
      return () => { clearTimeout(slam); clearTimeout(menu); };
    }
    if (shot >= 5) introSeen = true;
  }, [shot]);

  const [modes, more] = useMemo(() => {
    const nav = (s: Screen) => () => go(s);
    const climb = () => { void useGame.getState().newRun().then((started) => { if (started) go('instrument'); }); };
    const modes: Item[] = saved
      ? [
          { label: 'CONTINUE', note: `FLOOR ${saved.floor + 1} · ${saved.score.toLocaleString()} PTS`, act: () => { useGame.getState().continueRun(); go('map'); } },
          { label: 'NEW CLIMB', act: () => setOverlay('overwrite') },
        ]
      : [{ label: startingRun ? 'PREPARING…' : 'CAMPAIGN', act: climb }];
    modes.push({ label: 'TAVERN', act: nav('tavern') }, { label: 'GEMS AND I', act: nav('training') });
    const more: Item[] = [
      { label: 'HOW TO PLAY', act: nav('howto') },
      { label: 'MIC CHECK', act: nav('mic') },
      { label: 'LEADERBOARD', act: nav('leaderboard') },
      ...(user ? [{ label: 'PROFILE', act: nav('profile') }] : []),
      { label: 'BOSS DEMO', act: nav('bossdemo') },
      { label: 'CREDITS', act: nav('credits') },
    ];
    return [modes, more];
  }, [saved, user, go, setOverlay, startingRun]);
  const items = useMemo(() => [...modes, ...more], [modes, more]);

  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (shot < 5) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (s.overlay || s.transition || s.startingRun || e.repeat) return;
      if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'ArrowDown') { setSel((i) => (i + 1) % items.length); sfx('hover'); }
      if (e.key === 'ArrowUp') { setSel((i) => (i - 1 + items.length) % items.length); sfx('hover'); }
      if (e.key === 'Enter' || e.key === ' ') { sfx('click'); items[sel % items.length].act(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot, items, sel]);

  if (shot < 4) return <IntroMontage onLand={land} />;

  const busy = startingRun || Boolean(transition);
  const pick = (i: number) => { if (!busy) { sfx('click'); items[i].act(); } };
  const hover = (i: number) => { if (i !== sel) { setSel(i); sfx('hover'); } };
  const landing = shot === 4;
  const moreList = (
    <>
      {more.map((it, n) => (
        <button key={it.label} className="title-more-item tap" data-active={sel === modes.length + n} disabled={busy} onMouseEnter={() => hover(modes.length + n)} onClick={() => pick(modes.length + n)}>{it.label}</button>
      ))}
      {fullscreen && <button className="title-more-item tap" style={{ color: 'var(--sun)' }} onClick={() => { sfx('click'); void enterFullscreen(); }}>FULL SCREEN</button>}
    </>
  );

  return (
    <div className="fill" style={{ background: '#1B1D3A', animation: landing ? `introShake 320ms ${LAND_MS}ms linear both` : undefined }}>
      <Scene>
        <Bg src="/assets/bg/summit.png" />
        <div className="fill" style={{ backgroundImage: 'linear-gradient(180deg, rgba(16,17,38,0) 55%, rgba(16,17,38,0.9) 100%)' }} />
        {/* Riff stands on the summit's flat stone, feet on its front edge, rim-lit by the moon. */}
        <div style={{ position: 'absolute', left: 575, top: 366, width: 280, height: 320, backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,240,190,0.4) 0%, rgba(255,230,140,0.1) 55%, rgba(255,230,140,0) 75%)' }} />
        <Sprite src={instrumentOf(useGame.getState().run).sprite} x={545} y={356} size={340} style={{ transformOrigin: '50% 98%', animation: landing ? `titleLand ${LAND_MS + 260}ms linear both` : undefined }} />
        {landing && <>
          <div className="title-shock" style={{ left: 545, top: 664, width: 340, height: 48, animationDelay: `${LAND_MS}ms` }} />
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="intro-dust" style={{ left: 600 + i * 30, top: 676, ['--at' as string]: `${LAND_MS + (i % 2) * 30}ms`, ['--dx' as string]: `${(i - 3.5) * 26}px` }} />)}
        </>}
      </Scene>
      {/* The left of the scene darkens so the menu reads over the sky at any window shape. */}
      <div className="bleed" style={{ background: 'linear-gradient(90deg, rgba(16,17,38,0.8) 0%, rgba(16,17,38,0.5) 30%, rgba(16,17,38,0) 55%)' }} />
      {/* A plain img: pixel art must not be resampled, and art() already picks the light copy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="title-logo" src={art('/assets/logo.png')} alt="Slay the Choir" style={{ animation: landing ? `titleLogo 700ms ${LAND_MS}ms both` : undefined }} />

      {shot >= 5 && <>
        <nav aria-label="Main menu" className="title-menu ui-l ui-soft">
          {modes.map((it, i) => (
            <button key={it.label} className="title-mode" data-active={sel === i} data-first={i === 0} disabled={busy} onMouseEnter={() => hover(i)} onClick={() => pick(i)}>
              <svg className="title-pointer" width="16" height="24" viewBox="0 0 4 6" shapeRendering="crispEdges" aria-hidden="true"><path d="M0 0h1v6H0zM1 1h1v4H1zM2 2h1v2H2z" fill="#FFD23F" /></svg>
              <span>{it.label}{it.note && <small>{it.note}</small>}</span>
            </button>
          ))}
          <div className="title-more desk-only">{moreList}</div>
        </nav>
        <nav aria-label="More" className="title-more title-more-rail hand-only ui-br">{moreList}</nav>
        <AccountChip />
      </>}
    </div>
  );
}

/** Top-right account chip: sign in, or who is signed in. */
function AccountChip() {
  const user = useGame((s) => s.user);
  const setOverlay = useGame((s) => s.setOverlay);
  const box = { position: 'absolute', right: 'calc(40px - var(--rail-r))', top: 'calc(32px - var(--rail-t))', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(16,17,38,0.88)', animation: 'dropIn 300ms steps(5) both' } as const;
  if (!user) {
    return (
      <button className="title-account ui-tr f-press hoverable pressable" onMouseEnter={() => sfx('hover')} onClick={() => { sfx('click'); setOverlay('signin'); }} style={{ ...box, padding: '10px 16px', fontSize: 12, color: 'var(--sun)', border: '3px solid var(--sun)', boxShadow: '#101126 4px 4px 0' }}>
        <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true"><path d="M2 0h3v3H2zM1 4h5v3H1z" fill="#FFD23F" /></svg>
        SIGN IN
      </button>
    );
  }
  return (
    <div className="title-account ui-tr" style={{ ...box, padding: '8px 14px 8px 8px', border: '3px solid #3A3F70' }}>
      <div style={{ position: 'relative', width: 44, height: 44, overflow: 'hidden', background: '#2A2F55', border: '3px solid var(--sun)' }}>
        <div className="sprite" style={{ left: -68, top: 2, width: 150, height: 150, backgroundImage: `url(${art('/assets/sprites/riff-trumpet.png', 'thumb')})`, backgroundPosition: '50% 0' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="f-press" style={{ fontSize: 13, color: '#fff' }}>{user.username.toUpperCase()}</div>
        <div className="f-label" style={{ fontSize: 11, color: 'var(--sun)' }}>LV {user.level}{user.rank ? ` · RANK #${user.rank}` : ''}</div>
      </div>
      <button
        className="f-label tap"
        style={{ marginLeft: 6, paddingLeft: 12, borderLeft: '2px solid #3A3F70', fontSize: 11, color: 'var(--muted)' }}
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
