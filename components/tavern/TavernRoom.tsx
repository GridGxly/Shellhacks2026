'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '@/lib/audio';
import { TAVERN_PASS } from '@/lib/config';
import { INSTRUMENTS, type InstrumentId } from '@/lib/content';
import { Sprite } from '../ui';
import Crowd from './Crowd';
import Gags, { musicianReaction, tomatoThrows, verdictTargets, type StageSide } from './Gags';
import './tavern.css';

export type TavernPhase = 'lobby' | 'hosting' | 'ready' | 'countdown' | 'performing' | 'uploading' | 'waiting' | 'duet' | 'verdict' | 'disconnected';
export interface TavernStagePlayer {
  name: string;
  instrument: InstrumentId;
  /** Correct notes / total notes, from zero to one. */
  accuracy?: number;
}
export interface TavernRoomProps {
  phase: TavernPhase;
  mine: TavernStagePlayer;
  partner: TavernStagePlayer | null;
  joined: boolean;
  /** Milliseconds since the shared startAt minus the four-second preparation. -1 while idle. */
  lightElapsed: number;
  verdictElapsed: number;
  pass: boolean | null;
  activity: readonly [number, number];
  children?: ReactNode;
}

const emptyTargets = { hooked: null, tomatoes: [0, 0] as const };

export default function TavernRoom({ phase, mine, partner, joined, lightElapsed, verdictElapsed, pass, activity, children }: TavernRoomProps) {
  const verdict = phase === 'verdict';
  const targets = verdict && pass === false ? verdictTargets(mine.accuracy ?? 0, partner?.accuracy ?? 0) : emptyTargets;
  const throws = tomatoThrows(targets);
  const quiet = ['countdown', 'performing', 'uploading', 'waiting', 'duet'].includes(phase);
  const lit = lightElapsed >= 0 && (quiet || verdict);
  const shade = quiet ? Math.max(0, Math.min(0.72, Math.floor((lightElapsed - 150) / 75) * 0.18)) : 0;
  const crowdMode = verdict ? pass ? 'clap' : 'boo' : phase === 'duet' ? 'sway' : quiet && lightElapsed >= 1300 ? 'hush' : 'idle';
  const previousLight = useRef(-1);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (!joined) return;
    const landing = window.setTimeout(() => { sfx('impact'); setCheer(true); }, 300);
    const settle = window.setTimeout(() => setCheer(false), 500);
    return () => { window.clearTimeout(landing); window.clearTimeout(settle); };
  }, [joined]);
  useEffect(() => {
    if (lightElapsed < 0) { previousLight.current = -1; return; }
    for (const t of [700, 1000]) {
      if (previousLight.current < t && lightElapsed >= t && lightElapsed - t < 250) sfx('impact');
    }
    previousLight.current = lightElapsed;
  }, [lightElapsed]);

  return <div className={`tavern-room${joined ? ' tavern-join-shake' : ''}`} data-phase={phase}>
    <RoomBackdrop />
    {[156, 488, 952, 1280].map((x, i) => <div key={x} className="tavern-lamp-glow" aria-hidden="true" style={{ left: x - 130, opacity: quiet ? 0.3 : 1, animationDelay: `${i * -650}ms` }} />)}
    <div className="tavern-house-shade" aria-hidden="true" style={{ opacity: shade }} />
    <div className="tavern-chain" aria-hidden="true" style={{ transform: `translateY(${lightElapsed >= 0 && lightElapsed < 300 ? lightElapsed < 150 ? 28 : 12 : 0}px)` }}>
      <div /><span />
    </div>
    {([0, 1] as const).map((side) => {
      const on = lit && lightElapsed >= (side === 0 ? 700 : 1000);
      return <div key={side} className="tavern-spot" aria-hidden="true" data-lit={on} style={{ left: side === 0 ? 340 : 660, opacity: on ? 1 : 0 }}>
        <div className="tavern-cone" /><div className="tavern-pool" />
      </div>;
    })}
    {phase !== 'lobby' && phase !== 'disconnected' && <>
      {([mine, partner] as const).map((player, index) => {
        const side = index as StageSide;
        if (!player) return <div key="empty" className="tavern-empty" aria-label="Waiting for the second musician"><span>?</span><div className="f-label">YOUR DUET PARTNER</div></div>;
        const reaction = musicianReaction(side, verdictElapsed, targets, throws);
        const instrument = INSTRUMENTS.find((i) => i.id === player.instrument) ?? INSTRUMENTS[0];
        const playing = phase === 'performing' || phase === 'duet' || ((phase === 'waiting' || phase === 'uploading') && side === 1 && player.accuracy === undefined);
        const spotlightOn = lit && lightElapsed >= (side === 0 ? 700 : 1000);
        const brightness = quiet && !spotlightOn ? 1 - shade : 1;
        const palette = side === 1 && mine.instrument === partner?.instrument ? 'hue-rotate(160deg) saturate(1.2)' : '';
        return <div key={side}>
          <div className={`tavern-musician${joined && side === 1 ? ' tavern-guest-drop' : ''}`} style={{ left: side === 0 ? 390 : 710 }}>
            <div style={{ transform: `translateX(${reaction.x}px) skewX(${reaction.skew}deg)`, opacity: reaction.gone ? 0 : 1 }}>
              <div style={{ transform: side === 1 ? 'scaleX(-1)' : undefined }}>
                <Sprite src={instrument.sprite} x={0} y={0} size={340} className={playing ? 'tavern-playing' : 'tavern-breathing'} style={{ filter: `${palette} ${reaction.flash ? 'brightness(3) sepia(1) saturate(7) hue-rotate(315deg)' : `brightness(${brightness})`}` }} />
              </div>
            </div>
            {side === 1 && joined && <div className="tavern-landing-dust" aria-hidden="true">{Array.from({ length: 7 }, (_, n) => <i key={n} style={{ left: n * 32, animationDelay: `${300 + (n % 2) * 30}ms` }} />)}</div>}
          </div>
          {phase === 'duet' && <ActivityNotes side={side} level={activity[side]} />}
          <div className="tavern-nameplate" style={{ left: side === 0 ? 402 : 722 }}>
            <div className="tavern-name-line"><span className="f-press">{player.name}</span>{side === 0 && <b className="f-label">YOU</b>}</div>
            <span className="f-label tavern-instrument-name">{instrument.name}</span>
            {verdict && player.accuracy !== undefined && <strong className="f-press tavern-accuracy" style={{ color: player.accuracy >= TAVERN_PASS ? '#4CC26B' : '#FF8A93' }}>{Math.round(player.accuracy * 100 * Math.min(1, Math.max(0, verdictElapsed) / 1100))}%</strong>}
          </div>
        </div>;
      })}
    </>}
    <Crowd mode={crowdMode} cheer={joined && cheer} elapsed={verdictElapsed} throws={throws} />
    {verdict && pass === false && <Gags elapsed={verdictElapsed} targets={targets} />}
    {verdict && pass === true && <Ovation />}
    <div className="tavern-content">{children}</div>
  </div>;
}

function ActivityNotes({ side, level }: { side: StageSide; level: number }) {
  return <div className="tavern-activity-notes" aria-hidden="true" style={{ left: side === 0 ? 510 : 830 }}>
    {level > 0.025 && [0, 1, 2].map((n) => <span key={n} style={{ left: n * 28, animationDelay: `${n * -210}ms`, color: side === 0 ? '#FFD23F' : '#6EC6FF' }}>♪</span>)}
  </div>;
}

function Ovation() {
  return <div className="tavern-ovation" aria-hidden="true">
    {Array.from({ length: 18 }, (_, n) => <span key={n} className="tavern-cheer-note" style={{ left: 90 + (n * 173) % 1290, top: 736 + (n % 3) * 30, animationDelay: `${(n * 127) % 1300}ms`, color: ['#FFD23F', '#FF4FA3', '#6EC6FF'][n % 3] }}>{n % 4 === 0 ? '♥' : '♪'}</span>)}
    {Array.from({ length: 44 }, (_, n) => <i key={`c${n}`} className="tavern-confetti" style={{ left: (n * 173) % 1440, width: n % 2 ? 8 : 12, height: n % 2 ? 14 : 8, background: ['#FFD23F', '#FF4FA3', '#6EC6FF', '#FFF6E0'][n % 4], animationDelay: `${(n * 53) % 950}ms`, animationDuration: `${1900 + (n % 5) * 160}ms` }} />)}
  </div>;
}

function RoomBackdrop() {
  return <svg className="tavern-backdrop" viewBox="0 0 1440 900" shapeRendering="crispEdges" aria-hidden="true">
    <rect width="1440" height="900" fill="#3B2414" />
    <g transform="scale(8)">
      {Array.from({ length: 60 }, (_, i) => <g key={i}>
        <rect x={i * 3} width="3" height="89" fill={['#563621', '#50321F', '#60402A', '#472C1C'][i % 4]} />
        <rect x={i * 3} width="0.5" height="89" fill="#291C18" />
        {i % 5 === 0 && <path d={`M${i * 3 + 1} ${30 + (i * 7) % 46}h1v3h-1Z`} fill="#362419" />}
      </g>)}
      <rect x="0" y="13" width="180" height="7" fill="#271B17" /><rect x="0" y="13" width="180" height="1" fill="#8A5A33" />
      <rect x="0" y="1" width="180" height="3" fill="#201719" /><rect x="0" y="19" width="180" height="1" fill="#8A5A33" opacity="0.65" />
      <path d="M0 82H180V113H0Z" fill="#372819" />
      {[88, 96, 106].map((y) => <g key={y}><rect y={y} width="180" height="1" fill="#211A18" /><rect y={y + 1} width="180" height="0.5" fill="#65452B" /></g>)}
      {/* Shelves, bottles, two taps and the bar. */}
      <rect x="3" y="32" width="33" height="2" fill="#201A17" /><rect x="3" y="31" width="33" height="1" fill="#9E6D3F" />
      <rect x="5" y="24" width="3" height="7" fill="#3B5844" /><rect x="6" y="22" width="1" height="3" fill="#7E9C66" /><rect x="5.5" y="28" width="2" height="2" fill="#C9B880" />
      <rect x="14" y="26" width="3" height="5" fill="#665263" /><rect x="15" y="24" width="1" height="3" fill="#A98A82" /><rect x="14.5" y="28" width="2" height="2" fill="#D2B698" />
      <rect x="26" y="23" width="4" height="8" fill="#445C52" /><rect x="27" y="21" width="2" height="3" fill="#6D8667" /><rect x="27" y="27" width="2" height="2" fill="#C9B880" />
      <path d="M8 49V41H13V44H11V49Z M22 49V40H27V43H25V49Z" fill="#AD8042" />
      <rect x="0" y="51" width="38" height="28" fill="#432917" /><rect x="0" y="50" width="39" height="3" fill="#20191A" /><rect x="0" y="49" width="39" height="1" fill="#AA7747" />
      {[4, 16, 28].map((x) => <g key={x}><rect x={x} y="55" width="8" height="20" fill="#664229" /><rect x={x + 1} y="56" width="6" height="1" fill="#8A5A33" /><rect x={x + 1} y="57" width="1" height="16" fill="#34251D" /></g>)}
      {[4, 14, 25, 32].map((x) => <g key={x}><rect x={x} y="45" width="3" height="4" fill="#E8A93A" /><rect x={x + 3} y="46" width="1" height="2" fill="#BD8848" /><rect x={x} y="44" width="3" height="1.5" fill="#FFF3D6" /></g>)}
      {/* Small window and crossed lutes opposite the bar. */}
      <rect x="150" y="28" width="21" height="29" fill="#211F2D" /><rect x="151" y="29" width="19" height="27" fill="#1E2940" /><path d="M160 29V56 M151 42H170" stroke="#946139" strokeWidth="2" />
      <rect x="154" y="33" width="2" height="2" fill="#FFE6A8" /><rect x="165" y="47" width="1" height="1" fill="#9FD8FF" />
      <path d="M154 64h6v2h2v7h-2v2h-6v-2h-2v-7h2Z" fill="#9B6439" /><rect x="156" y="58" width="2" height="10" fill="#C69555" /><rect x="155" y="68" width="4" height="3" fill="#20191C" />
      {/* Stage, steps and velvet side curtains. */}
      <rect x="37" y="80" width="106" height="9" fill="#362519" />
      <rect x="37" y="79" width="106" height="2" fill="#A3703C" />
      {[43, 56, 69, 82, 95, 108, 121, 134].map((x) => <g key={x}><rect x={x} y="81" width="1" height="7" fill="#211919" /><rect x={x + 1} y="82" width="8" height="1" fill="#80522D" /></g>)}
      <rect x="37" y="88" width="106" height="1" fill="#17151B" /><rect x="66" y="89" width="48" height="3" fill="#6B472C" /><rect x="62" y="92" width="56" height="3" fill="#4D3524" />
      <path d="M34 20H44V71H40V78H34Z M136 20H146V78H140V71H136Z" fill="#49202B" /><path d="M36 21H39V74H36Z M141 21H144V74H141Z" fill="#76303D" />
      <rect x="34" y="54" width="10" height="2" fill="#A97C3A" /><rect x="136" y="54" width="10" height="2" fill="#A97C3A" />
      {[19.5, 61, 119, 160].map((x) => <g key={x}><rect x={x} y="3" width="1" height="19" fill="#151720" /><rect x={x - 2} y="21" width="5" height="1" fill="#AE7E3C" /><rect x={x - 3} y="22" width="7" height="9" fill="#191A23" /><rect x={x - 2} y="23" width="5" height="7" fill="#FFB347" /><rect x={x} y="23" width="1" height="7" fill="#A36B30" /><rect x={x - 1} y="24" width="1" height="5" fill="#FFE8A2" /><rect x={x - 2} y="31" width="5" height="1" fill="#7F5730" /></g>)}
    </g>
    <path d="M594 156V120 M846 156V120" stroke="#151720" strokeWidth="8" />
    <rect x="554" y="154" width="332" height="74" fill="#261C1C" stroke="#8A5A33" strokeWidth="8" />
    <rect x="564" y="164" width="312" height="54" fill="#362724" stroke="#BB8747" strokeWidth="2" />
    <text x="720" y="186" textAnchor="middle" fill="#F3D7A5" className="f-label" fontSize="14">THE RUSTY LUTE</text>
    <text x="720" y="208" textAnchor="middle" fill="#E7AB4F" className="f-press" fontSize="12">DUET NIGHT</text>
    <path d="M0 0H1440V900H0Z" fill="url(#tavern-vignette)" />
    <defs><radialGradient id="tavern-vignette"><stop offset="0.55" stopColor="#101126" stopOpacity="0" /><stop offset="1" stopColor="#101126" stopOpacity="0.58" /></radialGradient></defs>
  </svg>;
}
