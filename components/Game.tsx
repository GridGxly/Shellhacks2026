'use client';
import { useEffect, useState } from 'react';
import { useGame, type Screen } from '@/lib/store';
import { ac, applySettings, playMusic, preload, sfx } from '@/lib/audio';
import { ENEMIES } from '@/lib/content';
import { mic } from '@/lib/mic';
import { applyViewport, enterFullscreen, measureViewport, touchDevice } from '@/lib/viewport';
import { art } from '@/lib/art';
import Title from './screens/Title';
import Tavern from './screens/Tavern';
import Training from './screens/Training';
import { Credits, HowToPlay, MicCheck } from './screens/Menus';
import { PitchLab } from './screens/PitchLab';
import { BossDemo } from './screens/BossDemo';
import ChooseInstrument from './screens/ChooseInstrument';
import MapScreen from './screens/MapScreen';
import Combat from './screens/Combat';
import { ActClear, FinalVictory, Loss, Victory } from './screens/Results';
import { Leaderboard, Profile } from './screens/Social';
import { MapPeek, Pause, StatsOverlay } from './overlays/HudOverlays';
import { Overwrite, SignIn } from './overlays/Account';

export default function Game() {
  const [view, setView] = useState({ scale: 1, x: 720, y: 450 });
  const [booted, setBooted] = useState(false);
  const screen = useGame((s) => s.screen);
  const overlay = useGame((s) => s.overlay);
  const transition = useGame((s) => s.transition);
  const toast = useGame((s) => s.toast);
  // The ambient backdrop beside the frame on wide phones continues the current scene.
  const scene = useGame((s) => sceneBackground(s.screen, s.combat?.enemyIdx, s.run.floor));
  useEffect(() => { document.documentElement.style.setProperty('--scene-background', `url(${art(scene)})`); }, [scene]);

  useEffect(() => {
    // visualViewport tracks the area left after mobile browser bars show or hide.
    let stableHeight = window.innerHeight;
    let focusFrame = 0;
    const fit = () => {
      const v = window.visualViewport;
      const width = v?.width ?? window.innerWidth;
      const visibleHeight = v?.height ?? window.innerHeight;
      const editing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (!editing) stableHeight = visibleHeight;
      const height = editing ? Math.max(stableHeight, visibleHeight) : visibleHeight;
      document.documentElement.style.setProperty('--visual-height', `${visibleHeight}px`);
      document.documentElement.style.setProperty('--visual-top', `${v?.offsetTop ?? 0}px`);

      const next = measureViewport(width, height, v?.offsetLeft ?? 0, v?.offsetTop ?? 0);
      applyViewport(next);
      setView({ scale: next.scale, x: next.x, y: next.y });
    };
    const revealInput = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        fit();
        const input = document.activeElement;
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.scrollIntoView({ block: 'nearest' });
      });
    };
    fit();
    document.addEventListener('focusin', revealInput);
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    useGame.getState().hydrate();
    // Dev only: window.__stc.setState({...}) to jump around while building.
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __stc: typeof useGame }).__stc = useGame;
    try {
      const saved = localStorage.getItem('stc.settings.v1');
      if (saved) applySettings(JSON.parse(saved));
    } catch {
      /* defaults */
    }
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(async (u) => {
        if (!u) return;
        useGame.getState().setUser(u);
        // Restored session on a device with no local checkpoint: pull the cloud one (PRD §7b).
        if (useGame.getState().saved) return;
        const r = await fetch('/api/save');
        const body = r.ok ? await r.json() : null;
        if (body?.run) useGame.getState().adoptSave(body.run);
      })
      .catch(() => {});
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('focusin', revealInput);
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
    };
  }, []);

  // Global shortcuts: Esc = pause/back, M = map peek, C = stats.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      // Mid-performance/attack nothing can be paused, so these overlays wait for the player's turn.
      if (s.combatLocked && !s.overlay) return;
      if (e.key === 'Escape') {
        if (s.overlay) {
          sfx('back');
          s.setOverlay(null);
        } else if (s.screen === 'combat' || s.screen === 'map') {
          sfx('click');
          s.setOverlay('pause');
        }
      }
      if (s.overlay === 'mappeek' && (e.key === 'm' || e.key === 'M')) { sfx('back'); s.setOverlay(null); return; }
      if ((s.screen === 'combat' || s.screen === 'map') && !s.overlay) {
        if (e.key === 'm' || e.key === 'M') { sfx('click'); s.setOverlay('mappeek'); }
        if (e.key === 'c' || e.key === 'C') { sfx('click'); s.setOverlay('stats'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const boot = () => {
    // Resume both contexts inside a new gesture after a phone returns from the background.
    ac();
    mic.resume();
    if (booted) return;
    if (touchDevice()) void enterFullscreen(); // needs this first tap as its user gesture
    preload([
      ...new Set(ENEMIES.map((e) => e.attackSfx)),
      '/audio/sfx/ko-slam.mp3', '/audio/sfx/versus-slam.mp3', '/audio/sfx/encore-charge.mp3',
      '/audio/sfx/encore-hit.mp3', '/audio/sfx/victory-sting.mp3', '/audio/sfx/boss-lock-rattle.mp3',
    ]);
    setBooted(true);
    sfx('click');
    playMusic('title');
  };

  return (
    <div className="viewport" onPointerDown={boot} onKeyDown={boot} tabIndex={-1}>
      <div className="stage" style={{ left: view.x, top: view.y, transform: `translate(-50%, -50%) scale(${view.scale})` }}>
        {!booted ? (
          <BootGate onStart={boot} />
        ) : (
          <>
            {screen === 'title' && <Title />}
            {screen === 'tavern' && <Tavern />}
            {screen === 'training' && <Training />}
            {screen === 'howto' && <HowToPlay />}
            {screen === 'mic' && <MicCheck />}
            {screen === 'lab' && <PitchLab />}
            {screen === 'bossdemo' && <BossDemo />}
            {screen === 'credits' && <Credits />}
            {screen === 'instrument' && <ChooseInstrument />}
            {screen === 'map' && <MapScreen />}
            {screen === 'combat' && <Combat />}
            {screen === 'victory' && <Victory />}
            {screen === 'actclear' && <ActClear />}
            {screen === 'loss' && <Loss />}
            {screen === 'final' && <FinalVictory />}
            {screen === 'leaderboard' && <Leaderboard />}
            {screen === 'profile' && <Profile />}

            {overlay === 'stats' && <StatsOverlay />}
            {overlay === 'pause' && <Pause />}
            {overlay === 'mappeek' && <MapPeek />}
            {overlay === 'signin' && <SignIn />}
            {overlay === 'overwrite' && <Overwrite />}

            {toast && <Toast text={toast} />}
            {transition === 'wipe' && <Wipe />}
            {transition === 'iris' && <Iris />}
          </>
        )}
      </div>
      <RotateHint />
    </div>
  );
}

function sceneBackground(screen: Screen, enemyIdx: number | undefined, floor: number) {
  if (screen === 'combat' && enemyIdx !== undefined) return ENEMIES[enemyIdx].bg;
  if (screen === 'victory' || screen === 'actclear') return ENEMIES[Math.max(0, floor - 1)].bg;
  if (screen === 'loss') return ENEMIES[Math.min(ENEMIES.length - 1, floor)].bg;
  if (screen === 'map') return '/assets/bg/map.png';
  if (screen === 'instrument') return '/assets/bg/showroom.png';
  if (screen === 'tavern' || screen === 'training') return '/assets/bg/tavern.png';
  return '/assets/bg/summit.png';
}

/** Portrait phones: the 1440×900 stage would be a thin strip, so ask for landscape. */
function RotateHint() {
  return (
    <div className="rotate-hint" style={{ position: 'fixed', inset: 0, zIndex: 400, placeItems: 'center', background: '#07070f', padding: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <svg width="96" height="96" viewBox="0 0 16 16" shapeRendering="crispEdges" style={{ animation: 'rotatePhone 1.8s steps(6) infinite alternate' }}>
          <rect x="4" y="1" width="8" height="14" fill="#FFD23F" /><rect x="5" y="2" width="6" height="11" fill="#1B1D3A" />
          <rect x="7" y="13" width="2" height="1" fill="#101126" /><rect x="6" y="5" width="4" height="4" fill="#FF4FA3" />
        </svg>
        <div className="f-press" style={{ fontSize: 16, lineHeight: '26px', color: 'var(--sun)' }}>TURN YOUR<br />PHONE SIDEWAYS</div>
        <div className="f-body" style={{ fontSize: 18, lineHeight: '24px', color: 'var(--soft)', maxWidth: 280 }}>The Spire is a landscape climb. Tip: add it to your home screen to play full screen.</div>
      </div>
    </div>
  );
}

function BootGate({ onStart }: { onStart: () => void }) {
  return (
    <button className="fill" onClick={onStart} style={{ display: 'grid', placeItems: 'center', background: '#07070f' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {/* Server-rendered, so phones pick the light logo by media query rather than art(). */}
        <picture>
          <source media="(pointer: coarse) and (max-width: 500px), (pointer: coarse) and (max-height: 500px)" srcSet="/assets/m/logo.webp" type="image/webp" />
          <img src="/assets/logo.png" alt="Slay the Choir" width={520} style={{ display: 'block', animation: 'fadeIn 800ms both' }} />
        </picture>
        <div className="f-press boot-start" style={{ fontSize: 16, color: 'var(--sun)', animation: 'blink 1.1s steps(1) infinite' }}>
          <span className="kbd-only">PRESS ANY KEY</span>
          <span className="touch-only">TAP TO START</span>
        </div>
        <div className="f-label boot-hint" style={{ fontSize: 12, color: 'var(--muted)' }}>
          HEADPHONES RECOMMENDED · MIC REQUIRED TO PLAY FOR REAL
        </div>
      </div>
    </button>
  );
}

/** M3 stair-step wipe: magenta leading edge sweeps left to right. */
function Wipe() {
  useEffect(() => sfx('wipe'), []);
  const steps = 10;
  return (
    // Strips are sized in percent so the wipe covers the whole glass on handhelds.
    <div className="fill bleed" style={{ zIndex: 100, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: steps }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: -40,
            top: `${i * 10}%`,
            width: 'calc(100% + 80px)',
            height: 'calc(10% + 1px)',
            background: '#101126',
            boxShadow: '16px 0 0 #FF4FA3',
            animation: `wipeIn 340ms ${i * 20}ms var(--ease-out) both, wipeOut 340ms ${420 + i * 20}ms var(--ease-in) forwards`,
          }}
        />
      ))}
    </div>
  );
}

function Iris() {
  return (
    <div className="fill bleed" style={{ zIndex: 100, pointerEvents: 'none' }}>
      <div className="fill" style={{ background: '#07070f', animation: 'irisOpenClose 1100ms steps(14) both' }} />
      <style>{`@keyframes irisOpenClose { 0% { clip-path: circle(0% at 50% 50%); } 45%, 55% { clip-path: circle(80% at 50% 50%); } 100% { clip-path: circle(0% at 50% 50%); } }`}</style>
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      className="ui-tl"
      style={{
        position: 'absolute',
        left: 'calc(40px - var(--rail-l))',
        top: 'calc(var(--hud-bottom) + 107px)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px 14px 16px',
        background: 'rgba(16,17,38,0.95)',
        border: '3px solid var(--meadow)',
        boxShadow: '#101126 5px 5px 0',
        animation: 'slideInLeft 300ms var(--ease-out) both, fadeOut 400ms 2800ms forwards',
      }}
    >
      <svg width="32" height="32" viewBox="0 0 8 8" shapeRendering="crispEdges" style={{ animation: 'blink 300ms steps(1) 2' }}>
        <rect x="0" y="0" width="8" height="8" fill="#4CC26B" />
        <rect x="1" y="1" width="5" height="2" fill="#101126" />
        <rect x="2" y="5" width="4" height="3" fill="#FFF6E0" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="f-press" style={{ fontSize: 13, color: 'var(--meadow)' }}>CHECKPOINT SAVED</div>
        <div className="f-body" style={{ fontSize: 15, color: 'var(--soft)' }}>{text}</div>
      </div>
    </div>
  );
}
