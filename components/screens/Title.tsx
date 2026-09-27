'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { playFile, playMusic, sfx } from '@/lib/audio';
import { instrumentOf, useGame, type Screen } from '@/lib/store';
import { Arrow, Bg, FloatingNotes, Sprite, Stars } from '../ui';
import IntroMontage from './IntroMontage';
import { enterFullscreen, useFullscreenOffer, useViewport } from '@/lib/viewport';
import { art } from '@/lib/art';

let introSeen = false;
/** ms from shot 4 until Riff's feet hit the summit. */
const LAND_MS = 340;

type Item = { label: string; act: () => void; primary?: boolean; mode?: boolean };

export default function Title() {
  const { handheld } = useViewport();
  const fullscreen = useFullscreenOffer();
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
      // Riff falls back in from the intro's leap: the hit lands with his feet.
      sfx('impact', LAND_MS / 1000);
      const slam = window.setTimeout(() => void playFile('/audio/sfx/versus-slam.mp3', 0.8), LAND_MS);
      const menu = window.setTimeout(() => setShot(5), 1050);
      return () => { clearTimeout(slam); clearTimeout(menu); };
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
    list.splice(1, 0, { label: 'TAVERN MODE', mode: true, act: () => go('tavern') }, { label: 'GEMS AND I', mode: true, act: () => go('training') });
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

  const busy = startingRun || Boolean(transition);
  const lead = items.filter((i) => i.primary || i.mode);
  const links = items.filter((i) => !i.primary && !i.mode);
  const pick = (it: Item) => { if (!busy) { sfx('click'); it.act(); } };

  return (
    <div className="fill screen-clip" style={{ background: '#1B1D3A', animation: shot === 4 ? `introShake 320ms ${LAND_MS}ms linear both` : undefined }}>
      <Bg src="/assets/bg/summit.png" />
      <Stars />
      {/* Villain silhouettes (10 Second Ninja X idea) */}
      <Sprite src="/assets/sprites/choir.png" x={-150} y={150} size={720} style={{ opacity: 0.55, filter: 'brightness(0)', animation: 'bob 6s steps(4) infinite' }} />
      <Sprite src="/assets/sprites/serpent.png" x={1130} y={60} size={420} style={{ opacity: 0.45, filter: 'brightness(0)', animation: 'bob 5s 1s steps(4) infinite' }} />
      <div className="fill" style={{ backgroundImage: 'linear-gradient(180deg, rgba(16,17,38,0) 55%, rgba(16,17,38,0.9) 100%)' }} />
      {/* 01 Title: Riff stands on the summit's flat stone, feet on its front edge. */}
      <div style={{ position: 'absolute', left: 575, top: 366, width: 280, height: 320, backgroundImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,240,190,0.45) 0%, rgba(255,230,140,0.12) 55%, rgba(255,230,140,0) 75%)', animation: 'glow 3s steps(4) infinite' }} />
      <Sprite src={instrumentOf(useGame.getState().run).sprite} x={545} y={356} size={340} style={{ transformOrigin: '50% 98%', animation: shot === 4 ? `titleLand ${LAND_MS + 260}ms linear both` : 'breathe 1.2s steps(2) infinite' }} />
      <img
        src={art('/assets/logo.png')}
        alt="Slay the Choir"
        style={{ position: 'absolute', left: 430, top: 18, width: 580, animation: shot === 4 ? `titleLogo 700ms ${LAND_MS}ms both` : undefined }}
      />
      <FloatingNotes count={8} />
      {shot === 4 && <>
        <div className="title-shock" style={{ left: 715 - 170, top: 688 - 24, width: 340, height: 48, animationDelay: `${LAND_MS}ms` }} />
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="intro-dust" style={{ left: 600 + i * 30, top: 676, ['--at' as string]: `${LAND_MS + (i % 2) * 30}ms`, ['--dx' as string]: `${(i - 3.5) * 26}px` }} />)}
      </>}

      {/* Desktop: the menu sits below the summit so the stone Riff stands on stays in view. */}
      {shot >= 5 && !handheld && (
        <nav aria-label="Main menu" style={{ position: 'absolute', left: 0, top: 716, width: 1440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 124 }}>
            {lead.map((it) => {
              const i = items.indexOf(it);
              return (
                <MenuButton key={it.label} big disabled={busy} active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={i * 60}>
                  {it.label === 'TAVERN MODE' ? 'TAVERN' : it.label}{it.label === 'GEMS AND I' && <span className="f-label" style={{ fontSize: 15, color: '#9FD8FF', marginLeft: 20 }}>TRAINING</span>}
                </MenuButton>
              );
            })}
          </div>
          {saved && (
            <div className="f-label" style={{ fontSize: 13, color: 'var(--sun)', textShadow: '#101126 2px 2px 0', animation: 'fadeIn 400ms 120ms both' }}>
              {saved.score.toLocaleString()} PTS · {saved.tips} TIPS · HP {saved.hp}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 4 }}>
            {links.map((it, n) => {
              const i = items.indexOf(it);
              return (
                <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  {n > 0 && <div style={{ width: 6, height: 6, background: 'var(--magenta)' }} />}
                  <MenuButton disabled={busy} active={sel === i} onHover={() => setSel(i)} onClick={it.act} delay={180 + n * 40}>{it.label}</MenuButton>
                </div>
              );
            })}
          </div>
        </nav>
      )}

      {/* Handhelds: the same scene. The three modes ride the left rail at thumb
          height and the smaller links the right rail, both clear of the summit. */}
      {shot >= 5 && handheld && (
        <>
          <nav aria-label="Game modes" className="ui-l" style={{ position: 'absolute', left: 'calc(36px - var(--rail-l))', top: 470, translate: '0 -50%', width: 236, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: '#11162DEB', border: '4px solid #343852', boxShadow: '#101126 6px 6px 0', animation: 'fadeIn 300ms steps(3) both' }}>
            {lead.map((it) => it.primary ? (
              <button key={it.label} className="f-press pressable" disabled={busy} onClick={() => pick(it)} style={{ minHeight: 58, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, lineHeight: '16px', color: '#101126', background: 'var(--sun)', border: '4px solid #101126', boxShadow: 'inset -4px -4px 0 #D9A21B, #D1307E 5px 5px 0' }}>
                {saved ? 'CONTINUE' : it.label}
                {saved && <span className="f-label" style={{ fontSize: 10, letterSpacing: '0.08em' }}>FLOOR {saved.floor + 1} · {saved.score.toLocaleString()} PTS</span>}
              </button>
            ) : (
              <button key={it.label} className="f-press pressable tap" disabled={busy} onClick={() => pick(it)} style={{ minHeight: 46, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, lineHeight: '14px', color: '#fff', background: '#1E2140', border: '3px solid #3A3F70' }}>
                {it.label}
                {it.label === 'GEMS AND I' && <span className="f-label" style={{ fontSize: 10, color: '#9FD8FF' }}>TRAINING</span>}
              </button>
            ))}
          </nav>
          <nav aria-label="More" className="ui-br" style={{ position: 'absolute', right: 'calc(40px - var(--rail-r))', bottom: 'calc(28px - var(--rail-b))', display: 'flex', flexDirection: 'column', gap: 2, animation: 'fadeIn 300ms 120ms steps(3) both' }}>
            {links.map((it) => (
              <button key={it.label} className="f-label tap" disabled={busy} onClick={() => pick(it)} style={{ minHeight: 30, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.12em', color: '#C9B8E8', textShadow: '#101126 2px 2px 0', whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, flexShrink: 0, background: 'var(--magenta)', boxShadow: '#101126 2px 2px 0' }} />{it.label}
              </button>
            ))}
            {fullscreen && (
              <button className="f-label tap" onClick={() => { sfx('click'); void enterFullscreen(); }} style={{ minHeight: 30, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.12em', color: 'var(--sun)', textShadow: '#101126 2px 2px 0', whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, flexShrink: 0, background: 'var(--sun)', boxShadow: '#101126 2px 2px 0' }} />FULL SCREEN
              </button>
            )}
          </nav>
        </>
      )}
      {shot >= 5 && <AccountChip compact={handheld} />}
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

/** Top-right account chip. Handhelds anchor it to the right rail and drop the pitch line. */
function AccountChip({ compact }: { compact?: boolean }) {
  const user = useGame((s) => s.user);
  const setOverlay = useGame((s) => s.setOverlay);
  if (user) {
    return (
      <div className="title-account ui-tr" style={{ position: 'absolute', right: 'calc(40px - var(--rail-r))', top: 28, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px 8px 8px', background: 'rgba(16,17,38,0.85)', border: '3px solid #3A3F70', animation: 'dropIn 300ms steps(5) both' }}>
        <div style={{ position: 'relative', width: 44, height: 44, overflow: 'hidden', background: '#2A2F55', border: '3px solid var(--sun)' }}>
          <div className="sprite" style={{ left: -68, top: 2, width: 150, height: 150, backgroundImage: `url(${art('/assets/sprites/riff-trumpet.png')})`, backgroundPosition: '50% 0' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="f-press" style={{ fontSize: 13, color: '#fff' }}>{user.username.toUpperCase()}</div>
          <div className="f-label" style={{ fontSize: 11, color: 'var(--sun)' }}>LV {user.level}{user.rank ? ` · RANK #${user.rank}` : ''}</div>
        </div>
        <div style={{ width: 2, height: 32, background: '#3A3F70', margin: '0 4px' }} />
        <button
          className="f-label tap"
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
    <div className="title-account ui-tr" style={{ position: 'absolute', right: 'calc(40px - var(--rail-r))', top: 32, display: 'flex', alignItems: 'center', gap: 14, animation: 'dropIn 300ms steps(5) both' }}>
      {!compact && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div className="f-label" style={{ fontSize: 12, color: 'var(--muted)' }}>PLAYING AS GUEST</div>
        <div className="f-body" style={{ fontSize: 14, color: 'var(--soft)' }}>Sign in to save runs + get ranked</div>
      </div>}
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
