'use client';
import { useEffect, useState } from 'react';
import { sfx } from '@/lib/audio';
import { art } from '@/lib/art';
import { Bg, Sprite } from '../ui';

export const INTRO_LAND_MS = 4800;
const FRAME_MS = 1000 / 12;
const ramp = (t: number, start: number, end: number) => Math.max(0, Math.min(1, (t - start) / (end - start)));
const scenes = [
  { name: 'RIFF VS SNARE GOBLIN', bg: '/assets/bg/drum-hollow.png', foe: 'goblin', size: 370, color: '#FFD23F' },
  { name: 'THE SERPENT HITS BACK', bg: '/assets/bg/brass-canyon.png', foe: 'serpent', size: 440, color: '#6EC6FF' },
  { name: 'RIFF ANSWERS THE CHOIR', bg: '/assets/bg/choir-nave.png', foe: 'choir', size: 470, color: '#FF4FA3' },
];

/** A3's original exchanges, sampled on one 12 fps clock. */
export default function IntroMontage({ onLand }: { onLand: () => void }) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let frame: number | undefined;
    const timers: number[] = [];
    const sounds: [number, Parameters<typeof sfx>[0]][] = [
      [280, 'zap'], [730, 'impact'], [1480, 'drag'], [1930, 'hurt'],
      [2680, 'zap'], [3130, 'impact'], [3810, 'drag'],
    ];
    // Decode every pose before the clock starts: otherwise a cold hurt sprite
    // can disappear for the exact frame where the projectile makes contact.
    const assets = [...scenes.map((scene) => scene.bg), '/assets/bg/summit.png',
      ...['riff-trumpet', 'riff-attack', 'riff-hurt', 'riff-leap', 'goblin', 'goblin-attack', 'serpent', 'choir'].map((name) => `/assets/sprites/${name}.png`)].map((src) => art(src));
    void Promise.all(assets.map(async (src) => {
      const image = new Image(); image.src = src;
      await image.decode().catch(() => {});
    })).then(() => {
      if (cancelled) return;
      const started = performance.now();
      frame = window.setInterval(() => setTime(Math.floor((performance.now() - started) / FRAME_MS) * FRAME_MS), FRAME_MS);
      timers.push(...sounds.map(([at, sound]) => window.setTimeout(() => sfx(sound), at)), window.setTimeout(onLand, INTRO_LAND_MS));
    });
    return () => { cancelled = true; clearInterval(frame); timers.forEach(clearTimeout); };
  }, [onLand]);
  const beat = Math.min(3, Math.floor(time / 1200));
  const local = time - beat * 1200;
  return (
    <div className="fill" data-intro-beat={beat} data-intro-ms={time} style={{ background: '#101126', overflow: 'hidden' }}>
      {beat < 3 ? <Exchange key={beat} scene={beat} t={local} /> : <SummitLeap t={local} />}
      <div style={{ position: 'absolute', inset: '0 0 auto', height: 64, background: '#101126' }} />
      <div style={{ position: 'absolute', inset: 'auto 0 0', height: 64, background: '#101126' }} />
      <div className="f-label" style={{ position: 'absolute', right: 40, bottom: 26, fontSize: 14, color: '#C9CDE8' }}>
        <span className="kbd-only">ANY KEY TO SKIP</span><span className="touch-only">TAP TO SKIP</span>
      </div>
      <div style={{ position: 'absolute', left: 40, bottom: 30, display: 'flex', gap: 8 }}>
        {[0, 1, 2, 3].map((b) => <div key={b} style={{ width: 26, height: 6, background: b <= beat ? '#FFD23F' : '#3A3F70' }} />)}
      </div>
      <style>{`@media (hover:hover) and (pointer:fine){.touch-only{display:none}} @media (hover:none),(pointer:coarse){.kbd-only{display:none}}`}</style>
    </div>
  );
}

function Exchange({ scene, t }: { scene: number; t: number }) {
  const spec = scenes[scene];
  const enemyAttacks = scene === 1;
  const winding = t < 280;
  const fired = t >= 280;
  const struck = t >= 730;
  const recoil = struck ? Math.sin(ramp(t, 730, 1130) * Math.PI) * 60 : 0;
  const lunge = fired ? Math.sin(ramp(t, 280, 850) * Math.PI) * 32 : -18 * ramp(t, 0, 280);
  const riffX = 170 + (enemyAttacks ? -recoil : lunge);
  const foeX = 910 + (enemyAttacks ? -lunge : recoil);
  const origin = enemyAttacks ? { x: 975, y: 430 } : { x: 495, y: 432 };
  const target = enemyAttacks ? { x: 350, y: 440 } : { x: 1070, y: 432 };
  const impactFlash = struck && t < 900;
  return (
    <div className="fill" style={{ transform: impactFlash ? `translateX(${Math.floor(t / FRAME_MS) % 2 ? 6 : -6}px)` : undefined }}>
      <Bg src={spec.bg} style={{ filter: 'brightness(.6)' }} />
      <div className="fill" style={{ background: 'linear-gradient(180deg,rgba(16,17,38,.1),transparent 55%,rgba(16,17,38,.85))' }} />
      <div className="f-press" style={{ position: 'absolute', left: 80, top: 106, fontSize: 22, color: spec.color, textShadow: '#101126 4px 4px 0' }}>{spec.name}</div>
      <div style={{ position: 'absolute', left: 170, top: 643, width: 1160, height: 10, background: 'rgba(16,17,38,.65)' }} />
      <Sprite src={enemyAttacks && struck ? '/assets/sprites/riff-hurt.png' : fired && !enemyAttacks ? '/assets/sprites/riff-attack.png' : '/assets/sprites/riff-trumpet.png'} x={riffX} y={285} size={370} style={{ transform: `rotate(${enemyAttacks ? -recoil / 10 : winding ? -3 : 0}deg)`, filter: enemyAttacks && impactFlash ? 'brightness(2.5)' : undefined }} />
      <Sprite src={`/assets/sprites/${scene === 0 && !struck ? 'goblin-attack' : spec.foe}.png`} x={foeX} y={655 - spec.size} size={spec.size} style={{ transform: `rotate(${enemyAttacks && winding ? 5 : recoil / 12}deg)`, filter: !enemyAttacks && impactFlash ? 'brightness(3)' : undefined }} />
      {winding && <div style={{ position: 'absolute', left: origin.x - 26, top: origin.y - 26, width: 52, height: 52, border: `6px solid ${spec.color}`, transform: `scale(${.5 + ramp(t, 0, 280)})`, opacity: .7 }} />}
      {[0, 1, 2].map((i) => {
        const launched = 280 + i * 65;
        const p = ramp(t, launched, launched + 450);
        return t >= launched && p < 1 ? <Note key={i} x={origin.x + (target.x - origin.x) * p} y={origin.y + (target.y - origin.y) * p + (i - 1) * 25} color={spec.color} /> : null;
      })}
      {struck && <Burst x={target.x} y={target.y} t={t - 730} color={spec.color} />}
      <div className="f-label" style={{ position: 'absolute', left: enemyAttacks ? 840 : 150, top: 720, fontSize: 18, color: spec.color, opacity: fired ? 1 : .5 }}>
        {enemyAttacks ? 'SERPENT' : 'RIFF'} <span style={{ color: '#FFF6E0' }}>{struck ? '▸ DIRECT HIT' : winding ? '· READY…' : '▸ PLAY!'}</span>
      </div>
    </div>
  );
}

function SummitLeap({ t }: { t: number }) {
  const launch = ramp(t, 180, 850);
  const crouch = t < 180;
  const x = 390 + launch * 170;
  const y = crouch ? 438 : 438 - Math.sin(launch * Math.PI / 2) * 850;
  return (
    <div className="fill">
      <Bg src="/assets/bg/summit.png" style={{ transform: `translateY(${launch * 140}px) scale(1.2)`, filter: 'brightness(.65)' }} />
      <div className="f-press" style={{ position: 'absolute', left: 80, top: 106, fontSize: 22, color: '#FFD23F', textShadow: '#101126 4px 4px 0' }}>ONE MORE FLOOR.</div>
      <Sprite src={crouch ? '/assets/sprites/riff-trumpet.png' : '/assets/sprites/riff-leap.png'} x={x} y={y} size={370} style={{ transform: crouch ? 'scaleY(.86)' : 'rotate(-8deg)', transformOrigin: '50% 100%' }} />
      {t >= 180 && <Burst x={570} y={778} t={t - 180} color="#FFF6E0" />}
      {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ position: 'absolute', left: 480 + i * 42, top: 650 - launch * 340 + (i % 3) * 70, width: 6, height: launch * 150, background: '#FFD23F', opacity: launch > .1 && launch < .95 ? .5 : 0 }} />)}
      <div className="fill" style={{ background: '#101126', opacity: ramp(t, 950, 1200) }} />
    </div>
  );
}

function Note({ x, y, color }: { x: number; y: number; color: string }) {
  return <svg width="32" height="40" viewBox="0 0 8 10" shapeRendering="crispEdges" style={{ position: 'absolute', left: x - 16, top: y - 20 }}><path d="M5 0H7V8H5ZM0 6H6V10H0ZM7 0H8V4H7Z" fill={color} /></svg>;
}

function Burst({ x, y, t, color }: { x: number; y: number; t: number; color: string }) {
  const p = ramp(t, 0, 450);
  return <div style={{ position: 'absolute', left: x, top: y, opacity: 1 - p }}>
    {Array.from({ length: 8 }, (_, i) => { const angle = i * Math.PI / 4; return <div key={i} style={{ position: 'absolute', left: Math.cos(angle) * p * 110 - 7, top: Math.sin(angle) * p * 85 - 7, width: 14, height: 14, background: i % 2 ? color : '#FFF6E0' }} />; })}
    <div style={{ position: 'absolute', left: -24, top: -24, width: 48, height: 48, background: '#FFF6E0', transform: `rotate(45deg) scale(${1 - p})` }} />
  </div>;
}
