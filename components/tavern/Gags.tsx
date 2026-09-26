'use client';
import { useEffect, useRef } from 'react';
import { sfx } from '@/lib/audio';
import { TAVERN_PASS } from '@/lib/config';

export type StageSide = 0 | 1;
export const CROWD_POSITIONS = [
  { x: 76, y: 762 }, { x: 244, y: 720 }, { x: 406, y: 758 }, { x: 568, y: 730 },
  { x: 748, y: 750 }, { x: 920, y: 724 }, { x: 1100, y: 752 }, { x: 1274, y: 720 },
] as const;
export const HOOK_START = 2100;
const THROW_START = 700;
const THROW_GAP = 180;
const THROW_FLIGHT = 450;

export interface TomatoThrow { side: StageSide; npc: number; release: number; hit: number; x: number; y: number }
export interface VerdictTargets { hooked: StageSide | null; tomatoes: readonly [number, number] }

/** Fractions are compared directly; an exact tie gives both musicians the full volley. */
export function verdictTargets(mine: number, partner: number): VerdictTargets {
  if (mine === partner) return { hooked: null, tomatoes: [5, 5] };
  const worse: StageSide = mine < partner ? 0 : 1;
  const better: StageSide = worse === 0 ? 1 : 0;
  const hooked = (better === 0 ? mine : partner) >= TAVERN_PASS ? better : null;
  return { hooked, tomatoes: worse === 0 ? [5, hooked === null ? 3 : 0] : [hooked === null ? 3 : 0, 5] };
}

/** Battle applause belongs to the winner; only the losing musician is targeted. */
export function pvpVerdictTargets(winnerSide: StageSide | null | undefined): VerdictTargets {
  return { hooked: null, tomatoes: winnerSide === 0 ? [0, 5] : winnerSide === 1 ? [5, 0] : [0, 0] };
}

export function tomatoThrows(targets: VerdictTargets): TomatoThrow[] {
  const throwers = [[1, 3, 0, 2, 4], [6, 5, 7, 4, 3]];
  return ([0, 1] as const).flatMap((side) => Array.from({ length: targets.tomatoes[side] }, (_, n) => ({
    side, npc: throwers[side][n], release: THROW_START + n * THROW_GAP + side * 90,
    hit: THROW_START + n * THROW_GAP + side * 90 + THROW_FLIGHT,
    x: (side === 0 ? 560 : 880) + [-18, 20, -10, 28, 0][n],
    y: [444, 512, 472, 536, 496][n],
  })));
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const stepped = (n: number, steps: number) => Math.floor(clamp(n) * steps) / steps;

export function musicianReaction(side: StageSide, elapsed: number, targets: VerdictTargets, throws: TomatoThrow[]) {
  const hooked = targets.hooked === side;
  const pull = hooked ? stepped((elapsed - HOOK_START - 480) / 300, 4) : 0;
  const impact = throws.filter((t) => t.side === side).find((t) => elapsed >= t.hit && elapsed < t.hit + 160);
  const flinch = impact ? (side === 0 ? -1 : 1) * (Math.floor((elapsed - impact.hit) / 40) % 2 === 0 ? 18 : -8) : 0;
  return { x: (side === 0 ? -940 : 940) * pull + flinch, skew: pull > 0 && pull < 1 ? (side === 0 ? 10 : -10) : 0, flash: !!impact, gone: pull >= 1 };
}

/** Scene time, rather than independently mounted CSS animations, owns every throw and hit. */
export default function Gags({ elapsed, targets }: { elapsed: number; targets: VerdictTargets }) {
  const throws = tomatoThrows(targets);
  const previous = useRef(-1);
  const left = targets.tomatoes[0];
  const right = targets.tomatoes[1];
  useEffect(() => {
    const before = previous.current;
    if (elapsed < before) previous.current = -1;
    const from = elapsed < before ? -1 : before;
    const crossed = (t: number) => from < t && elapsed >= t && elapsed - t < 250;
    for (const t of tomatoThrows({ hooked: targets.hooked, tomatoes: [left, right] })) {
      if (crossed(t.release)) sfx('drag');
      if (crossed(t.hit)) { sfx('impact'); sfx('damage', 0.035); }
    }
    if (targets.hooked !== null) {
      if (crossed(HOOK_START + 400)) sfx('tick');
      if (crossed(HOOK_START + 480)) sfx('back');
    }
    previous.current = elapsed;
  }, [elapsed, targets.hooked, left, right]);

  return (
    <svg className="tavern-gags" viewBox="0 0 1440 900" aria-hidden="true" shapeRendering="crispEdges">
      {throws.map((t, i) => {
        if (elapsed < t.release) return null;
        if (elapsed >= t.hit) return <Splat key={i} x={t.x} y={t.y} />;
        const p = stepped((elapsed - t.release) / THROW_FLIGHT, 9);
        const source = CROWD_POSITIONS[t.npc];
        const x = source.x + 40 + (t.x - source.x - 40) * p;
        const y = source.y + 8 + (t.y - source.y - 8) * p - Math.sin(Math.PI * p) * 260;
        return <g key={i} transform={`translate(${Math.round(x / 4) * 4} ${Math.round(y / 4) * 4}) rotate(${Math.floor(p * 4) * 90})`}>
          <path d="M-8-4h4v-4h12v4h4v12H8v4H-4V8h-4Z" fill="#101126" />
          <path d="M-4-4H8V8H-4Z" fill="#E8434F" /><path d="M-4-4H4V0H-4Z" fill="#FF8A93" />
          <path d="M0-8H4v4H0Z M-4-4H8V0H-4Z" fill="#4CC26B" />
        </g>;
      })}
      {targets.hooked !== null && elapsed >= HOOK_START && <Cane side={targets.hooked} elapsed={elapsed - HOOK_START} />}
    </svg>
  );
}

function Splat({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M-16-8H-8V-16H8V-8H16V8H8V16H-8V8H-16Z M-28-16H-20V-8H-28Z M20-24H28V-16H20Z M24 8H32V16H24Z M-20 20H-12V32H-20Z M4 24H12V40H4Z" fill="#BB243E" />
    <path d="M-8-8H8V0H-8Z M-24-12H-20V-8H-24Z" fill="#FF6B76" />
  </g>;
}

function Cane({ side, elapsed }: { side: StageSide; elapsed: number }) {
  const enter = stepped(elapsed / 400, 6);
  const pull = stepped((elapsed - 480) / 300, 4);
  const distance = -690 * (1 - enter) - 940 * pull;
  return <g transform={side === 0 ? `translate(${distance} 0)` : `translate(${1440 - distance} 0) scale(-1 1)`}>
    <path d="M-160 546H576V534H592V506H576V494H548V506H540" fill="none" stroke="#101126" strokeWidth="22" />
    <path d="M-160 546H576V534H592V506H576V494H548V506H540" fill="none" stroke="#8A5A33" strokeWidth="10" />
    <path d="M540 530V510H548V502H576V510H584V530" fill="none" stroke="#FFD23F" strokeWidth="6" />
  </g>;
}
