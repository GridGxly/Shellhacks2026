'use client';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playFile, sfx } from '@/lib/audio';
import { art } from '@/lib/art';
import { STAGE_W, useViewport } from '@/lib/viewport';
import './intro.css';

// A3 intro: three exchanges up the Spire, then Riff leaps for the summit and
// the title lands (Title.tsx shot 4). Every time below is ms from the first frame.
const A = 0; // Snare Goblin: Riff opens the climb
const B = 1350; // Brass Serpent hits back
const C = 2650; // The Hollow Choir takes the Encore
const D = 3950; // the summit leap
export const INTRO_LAND_MS = 5000;

const FLOOR = 646; // feet line in the three battle backgrounds
const RIFF = 370;
// Each pose sits at a different height in its 1024 canvas; these keep the feet planted.
const feet = { idle: 0.979, attack: 0.933, hurt: 0.9375, leap: 0.963, goblin: 0.959, serpent: 0.99, choir: 0.996 };
const top = (size: number, k: number, floor = FLOOR) => floor - size * k;
const sprite = (name: string) => art(`/assets/sprites/${name}.png`);
const v = (vars: Record<string, string | number>) => vars as CSSProperties;
const ms = (n: number) => `${n}ms`;

const SOUNDS: [number, () => void][] = [
  [A + 150, () => void playFile('/audio/sfx/goblin-attack.mp3', 0.55)],
  [A + 600, () => sfx('zap')],
  [A + 880, () => sfx('impact')],
  [B + 330, () => void playFile('/audio/sfx/serpent-attack.mp3', 0.8)],
  [B + 650, () => sfx('hurt')],
  [C + 300, () => void playFile('/audio/sfx/encore-charge.mp3', 0.7)],
  [C + 650, () => sfx('zap')],
  [C + 910, () => void playFile('/audio/sfx/encore-hit.mp3', 0.9)],
  [D + 440, () => sfx('wipe')],
];

export default function IntroMontage({ onLand }: { onLand: () => void }) {
  const [ready, setReady] = useState(false);
  // Phones: grow the film toward the glass width, capped so captions and feet stay on screen.
  const { handheld, bleedX } = useViewport();
  const introK = handheld ? Math.min(1.45, 1 + (2 * bleedX) / STAGE_W) : 1;
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timers.push(window.setTimeout(onLand, 300));
      return () => timers.forEach(clearTimeout);
    }
    // Decode every pose first: a cold sprite must not blink out on the exact
    // frame a projectile lands.
    const assets = ['drum-hollow', 'brass-canyon', 'choir-nave', 'summit'].map((b) => art(`/assets/bg/${b}.png`))
      .concat(['riff-trumpet', 'riff-attack', 'riff-hurt', 'riff-leap', 'goblin', 'goblin-attack', 'serpent', 'choir'].map(sprite));
    void Promise.all(assets.map(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode().catch(() => {});
    })).then(() => {
      if (cancelled) return;
      setReady(true);
      timers.push(...SOUNDS.map(([at, play]) => window.setTimeout(play, at)), window.setTimeout(onLand, INTRO_LAND_MS));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [onLand]);

  if (!ready) return <div className="intro" />;
  return (
    <div className="intro" style={v({ '--intro-k': introK })}>
      <GoblinBeat />
      <SerpentBeat />
      <ChoirBeat />
      <SummitBeat />
      <div className="intro-wipe" style={v({ '--at': ms(B - 150) })} />
      <div className="intro-wipe" style={v({ '--at': ms(C - 150) })} />
      <div className="intro-screen-flash" style={v({ '--at': ms(D - 170), '--t': '560ms', '--o': 1, background: '#FFF6E0' })} />
      <div className="intro-screen-flash" style={v({ '--at': ms(INTRO_LAND_MS - 260), '--t': '600ms', '--o': 1, background: '#07070f' })} />
      <div className="intro-bars fill" />
      <div className="intro-pips ui-bl">
        {[A, B, C, D].map((at, i) => <i key={at} style={v({ '--at': ms(at), '--dur': ms(([B, C, D, INTRO_LAND_MS][i]) - at) })} />)}
      </div>
      <div className="intro-skip ui-br"><span className="kbd-only">ANY KEY TO SKIP</span><span className="touch-only">TAP TO SKIP</span></div>
    </div>
  );
}

function Beat({ at, dur, bg, dim = 0.62, hit, heavy, origin = 235, children }: { at: number; dur: number; bg: string; dim?: number; hit?: number; heavy?: boolean; origin?: number; children: ReactNode }) {
  return (
    // `origin` is the stage row that stays put when a phone scales the beat up to fill the glass.
    <div className="intro-beat" style={v({ '--at': ms(at), '--dur': ms(dur), '--intro-o': `${origin}px` })}>
      <div className="intro-cam">
        <div className="intro-shake" data-hit={hit === undefined ? undefined : heavy ? 'heavy' : ''} style={v({ '--hit': ms(hit ?? 0) })}>
          <div className="intro-sprite intro-bg" style={{ left: -80, top: 0, width: 1600, height: 900, backgroundImage: `url(${art(`/assets/bg/${bg}.png`)})`, backgroundSize: 'cover', backgroundPosition: '50%', filter: `brightness(${dim})` }} />
          <div className="bleed" style={{ background: 'linear-gradient(180deg, rgba(16,17,38,.25), transparent 45%, rgba(16,17,38,.85))' }} />
          {children}
        </div>
      </div>
    </div>
  );
}

/** A pose shown only between `from` and `from + dur` (`idle` is the inverse), flashing white when hit. */
function Pose({ name, x, size, k, from, dur, idle, hit, style }: { name: string; x: number; size: number; k: number; from?: number; dur?: number; idle?: boolean; hit?: number; style?: CSSProperties }) {
  const windowed = from !== undefined && dur !== undefined;
  const animation = [
    windowed && `${idle ? 'introOff' : 'introOn'} ${dur}ms ${from}ms forwards`,
    hit !== undefined && `introHitFlash 150ms ${hit}ms forwards`,
  ].filter(Boolean).join(', ') || undefined;
  return (
    <div className="intro-sprite" style={{ left: x, top: top(size, k), width: size, height: size, backgroundImage: `url(${sprite(name)})`, visibility: windowed && !idle ? 'hidden' : undefined, animation, ...style }} />
  );
}

function Shadow({ x, width }: { x: number; width: number }) {
  return <div className="intro-shadow" style={{ left: x, top: FLOOR - 9, width }} />;
}

function Barrage({ from, to, at, count, gap, t, colors, big }: { from: [number, number]; to: [number, number]; at: number; count: number; gap: number; t: number; colors: string[]; big?: boolean }) {
  const size = big ? 44 : 32;
  return <>{Array.from({ length: count }, (_, i) => (
    <div key={i} className="intro-note" style={v({ left: from[0] - size / 2, top: from[1] - size / 2 + ((i * 29) % 50) - 25, '--at': ms(at + i * gap), '--t': ms(t), '--dx': `${to[0] - from[0]}px`, '--dy': `${to[1] - from[1] - ((i * 29) % 50) + 25}px`, '--lift': `${60 + ((i * 47) % 90)}px` })}>
      <i><svg width={size} height={size * 1.25} viewBox="0 0 8 10" shapeRendering="crispEdges"><path d="M5 0H7V8H5ZM0 6H6V10H0ZM7 0H8V4H7Z" fill={colors[i % colors.length]} /></svg></i>
    </div>
  ))}</>;
}

function Impact({ x, y, at, color, big }: { x: number; y: number; at: number; color: string; big?: boolean }) {
  const ring = big ? 300 : 170;
  return <>
    <div className="intro-ring" style={v({ left: x - ring / 2, top: y - ring / 2, width: ring, height: ring, '--at': ms(at), borderColor: color })} />
    {Array.from({ length: big ? 12 : 8 }, (_, i) => {
      const angle = (i / (big ? 12 : 8)) * Math.PI * 2 + 0.3;
      const reach = (big ? 220 : 130) + (i % 3) * 30;
      return <div key={i} className="intro-spark" style={v({ left: x - 7, top: y - 7, background: i % 2 ? color : '#FFF6E0', '--at': ms(at + (i % 3) * 20), '--dx': `${Math.cos(angle) * reach}px`, '--dy': `${Math.sin(angle) * reach * 0.8}px` })} />;
    })}
  </>;
}

function Caption({ at, dur, x, y, align = 'left', color, label, name }: { at: number; dur: number; x: number; y: number; align?: 'left' | 'right' | 'center'; color: string; label: string; name: string }) {
  const pos: CSSProperties = align === 'right' ? { right: 1440 - x, top: y } : align === 'center' ? { left: 0, width: 1440, top: y } : { left: x, top: y };
  return (
    <div className="intro-caption" data-align={align} style={v({ ...pos, '--from': ms(at), '--for': ms(dur), '--c': color })}>
      <b>{label}</b>
      <hr />
      <strong>{name}</strong>
    </div>
  );
}

function GoblinBeat() {
  const hit = A + 880;
  return (
    <Beat at={A} dur={B - A} bg="drum-hollow" hit={hit}>
      <div className="intro-floor" />
      {/* Riff slides in, leans back, lunges as the notes leave the bell. */}
      <div className="intro-layer intro-enter-left" style={v({ '--at': ms(A) })}>
        <div className="intro-layer intro-attack" style={v({ '--at': ms(A + 380), transformOrigin: `375px ${FLOOR}px` })}>
          <Shadow x={255} width={190} />
          <Pose name="riff-trumpet" x={190} size={RIFF} k={feet.idle} from={A + 560} dur={420} idle />
          <Pose name="riff-attack" x={190} size={RIFF} k={feet.attack} from={A + 560} dur={420} />
        </div>
      </div>
      {/* The goblin drums, eats the barrage, and is knocked back. */}
      <div className="intro-layer intro-knock" style={v({ '--at': ms(hit + 60), '--kx': '90px', '--kr': '9deg', transformOrigin: `1085px ${FLOOR}px` })}>
        <Shadow x={985} width={220} />
        <Pose name="goblin" x={900} size={RIFF} k={feet.goblin} from={A + 120} dur={560} idle hit={hit} />
        <Pose name="goblin-attack" x={900} size={RIFF} k={feet.goblin - 0.014} from={A + 120} dur={560} />
      </div>
      <Barrage from={[560, 468]} to={[1085, 452]} at={A + 600} count={5} gap={42} t={280} colors={['#FFD23F', '#FF4FA3', '#9FD8FF']} />
      <Impact x={1085} y={452} at={hit} color="#FFD23F" />
      <div className="intro-screen-flash" style={v({ '--at': ms(hit), '--t': '180ms', '--o': 0.35, background: '#FFF6E0' })} />
      <Caption at={A + 180} dur={1020} x={88} y={104} color="#FFD23F" label="FLOOR 1" name="SNARE GOBLIN" />
    </Beat>
  );
}

function SerpentBeat() {
  const hit = B + 650;
  return (
    <Beat at={B} dur={C - B} bg="brass-canyon" hit={hit}>
      <div className="intro-floor" />
      {/* The serpent rears back, strikes, and its notes land on Riff. */}
      <div className="intro-layer intro-knock" style={v({ '--at': ms(hit + 60), '--kx': '-80px', '--kr': '-7deg', transformOrigin: `375px ${FLOOR}px` })}>
        <Shadow x={255} width={190} />
        <Pose name="riff-trumpet" x={190} size={RIFF} k={feet.idle} from={hit} dur={460} idle hit={hit} />
        <Pose name="riff-hurt" x={190} size={RIFF} k={feet.hurt} from={hit} dur={460} hit={hit} />
      </div>
      <div className="intro-layer intro-strike" style={v({ '--at': ms(B + 120), transformOrigin: `1080px ${FLOOR}px` })}>
        <Shadow x={960} width={280} />
        <Pose name="serpent" x={860} size={440} k={feet.serpent} />
      </div>
      <Barrage from={[950, 372]} to={[362, 452]} at={B + 330} count={5} gap={40} t={300} colors={['#E8434F', '#FF8A93', '#FFF6E0']} />
      <Impact x={362} y={452} at={hit} color="#E8434F" />
      <div className="intro-screen-flash" style={v({ '--at': ms(hit), '--t': '300ms', '--o': 0.5, background: 'radial-gradient(ellipse 70% 70% at 30% 55%, rgba(232,67,79,0) 20%, rgba(232,67,79,.95))' })} />
      <Caption at={B + 160} dur={1000} x={1352} y={104} align="right" color="#6EC6FF" label="FLOOR 2" name="BRASS SERPENT" />
    </Beat>
  );
}

function ChoirBeat() {
  const hit = C + 910;
  return (
    <Beat at={C} dur={D - C} bg="choir-nave" dim={0.42} hit={hit} heavy>
      <div className="intro-floor" />
      <div className="intro-glow" style={v({ left: 780, top: 90, width: 620, height: 620, background: 'radial-gradient(circle, rgba(255,79,163,.28), transparent 65%)', '--at': ms(C + 80), '--dur': '700ms' })} />
      {/* The Choir rises out of the dark while Riff charges the Encore. */}
      <div className="intro-layer intro-knock" style={v({ '--at': ms(hit + 80), '--kx': '70px', '--kr': '4deg', transformOrigin: `1090px ${FLOOR}px` })}>
        <div className="intro-layer intro-rise" style={v({ '--at': ms(C + 60), transformOrigin: `1090px ${FLOOR}px` })}>
          <Shadow x={970} width={320} />
          <Pose name="choir" x={830} size={520} k={feet.choir} hit={hit} />
        </div>
      </div>
      <div className="intro-layer intro-attack" style={v({ '--at': ms(C + 470), transformOrigin: `375px ${FLOOR}px` })}>
        <Shadow x={255} width={190} />
        <Pose name="riff-trumpet" x={190} size={RIFF} k={feet.idle} from={C + 650} dur={500} idle />
        <Pose name="riff-attack" x={190} size={RIFF} k={feet.attack} from={C + 650} dur={500} />
      </div>
      <div className="intro-charge" style={v({ left: 560 - 70, top: 470 - 70, width: 140, height: 140, '--at': ms(C + 300) })} />
      <Barrage from={[566, 470]} to={[1090, 382]} at={C + 660} count={7} gap={28} t={250} colors={['#FF4FA3', '#FFD23F', '#FFF6E0', '#9FD8FF']} big />
      <Impact x={1090} y={382} at={hit} color="#FF4FA3" big />
      <div className="intro-screen-flash" style={v({ '--at': ms(hit), '--t': '260ms', '--o': 0.95, background: '#FFF6E0' })} />
      <Caption at={C + 150} dur={900} x={0} y={96} align="center" color="#FF4FA3" label="FLOOR 3 · BOSS" name="THE HOLLOW CHOIR" />
    </Beat>
  );
}

function SummitBeat() {
  const crouch = D + 200;
  const leap = D + 440;
  return (
    <Beat at={D} dur={INTRO_LAND_MS - D + 400} bg="summit" dim={0.72} origin={820}>
      {/* The camera tilts up the summit as Riff crouches and leaps out of frame. */}
      <div className="fill" style={v({ animation: `introTilt 1200ms ${ms(D)} cubic-bezier(.45,0,.35,1) both` })}>
        <div className="intro-layer intro-crouch" style={v({ '--at': ms(crouch), transformOrigin: '715px 688px' })}>
          <div className="intro-layer intro-leap" style={v({ '--at': ms(leap), transformOrigin: '715px 688px' })}>
            <Pose name="riff-trumpet" x={545} size={340} k={feet.idle} from={leap} dur={2000} idle style={{ top: 688 - 340 * feet.idle }} />
            <Pose name="riff-leap" x={545} size={340} k={feet.leap} from={leap} dur={2000} style={{ top: 688 - 340 * feet.leap }} />
          </div>
        </div>
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="intro-dust" style={v({ left: 600 + i * 36, top: 676, '--at': ms(leap + (i % 2) * 30), '--dx': `${(i - 3) * 22}px` })} />)}
      </div>
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="intro-speed" style={v({ left: 470 + i * 70 + (i % 2) * 18, top: 60 + (i % 3) * 90, height: 120 + (i % 3) * 60, '--at': ms(leap + 60 + (i % 4) * 50) })} />)}
      <Caption at={D + 160} dur={1100} x={0} y={764} align="center" color="#FFD23F" label="THE SUMMIT" name="ONE MORE FLOOR." />
    </Beat>
  );
}
