'use client';

import type { ReactNode } from 'react';
import './training-stage.css';

export type TrainingStagePhase = 'welcome' | 'configure' | 'preview' | 'countin' | 'performing' | 'feedback' | 'complete' | 'paused';
export type TrainingMentor = 'castor' | 'pollux';
export interface TrainingPreviewNote { atMs: number; durationMs: number }
export interface TrainingStageProps {
  phase: TrainingStagePhase;
  activeMentor?: TrainingMentor | null;
  /** Milliseconds since the entrance began; -1 while inactive. */
  introElapsed?: number;
  /** Milliseconds since preview began, including the audio scheduler's lead-in. */
  playbackElapsed?: number;
  /** Actual scheduled note onsets, including lead-in, from the preview audio clock. */
  previewNotes?: readonly TrainingPreviewNote[];
  /** Milliseconds since a claim was accepted; never start this on the button click. */
  rewardElapsed?: number;
  rewardTarget?: { x: number; y: number };
  activity?: number;
  /** What the speaking twin is saying, shown in a bubble over his head. */
  line?: string | null;
  children?: ReactNode;
}

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const entrance: readonly TrainingPreviewNote[] = [{ atMs: 160, durationMs: 240 }, { atMs: 540, durationMs: 240 }];

/** How brightly a twin's star rings for the notes they play (even notes Castor, odd Pollux). */
export function trainingGlow(elapsed: number, notes: readonly TrainingPreviewNote[], side: 0 | 1) {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  let onset: TrainingPreviewNote | undefined;
  for (let i = side; i < notes.length; i += 2) if (notes[i].atMs <= elapsed) onset = notes[i];
  if (!onset) return 0;
  return 1 - clamp((elapsed - onset.atMs) / Math.max(180, Math.min(400, onset.durationMs)));
}

const STARS = [
  { id: 'castor', name: 'CASTOR', color: '#A87520', star: '#DDF3FF', x: 200 },
  { id: 'pollux', name: 'POLLUX', color: '#8E1F57', star: '#FFC46B', x: 330 },
] as const;

export default function TrainingStage({ phase, activeMentor = null, line = null, introElapsed = -1, playbackElapsed = -1, previewNotes = [], rewardElapsed = -1, rewardTarget = { x: 1060, y: 740 }, children }: TrainingStageProps) {
  const entering = phase === 'welcome' && introElapsed >= 0 && introElapsed < 1200;
  const elapsed = entering ? introElapsed : phase === 'preview' ? playbackElapsed : -1;
  const notes = entering ? entrance : previewNotes;
  const claiming = phase === 'complete' && rewardElapsed >= 0 && rewardElapsed < 1100;
  const reward = clamp(rewardElapsed / 900);

  return <div className="training-stage" data-phase={phase}>
    <div className="training-sky bleed" aria-hidden="true">
      <svg className="training-gemini" width="1440" height="560" viewBox="0 0 1440 560">
        <path d="M560 120 L640 170 L720 150 L800 170 L880 120 M640 170 L610 300 M800 170 L830 300" stroke="#3A3F70" strokeWidth="3" fill="none" />
        <path d="M554 114h12v12h-12zM874 114h12v12h-12z" fill="#DDF3FF" />
        <path d="M636 166h8v8h-8zM716 146h8v8h-8zM796 166h8v8h-8zM606 296h8v8h-8zM826 296h8v8h-8z" fill="#9AA0C8" />
      </svg>
    </div>
    <div className="training-pair" data-speaking={activeMentor ?? undefined} aria-hidden="true">
      {STARS.map((twin, side) => <div key={twin.id} className="training-star-glow" style={{ left: twin.x - 60, opacity: Math.max(trainingGlow(elapsed, notes, side as 0 | 1), activeMentor === twin.id ? 0.7 : 0), background: `radial-gradient(circle, ${twin.star} 0%, transparent 65%)` }} />)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="training-dioscuri" src="/assets/training/dioscuri.svg" alt="" width={360} height={380} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="training-canon" src="/assets/training/harmonic-canon.svg" alt="" width={460} height={166} />
      <div className="training-canon-label">HARMONIC CANON II</div>
    </div>
    {activeMentor && line && (() => {
      const twin = STARS.find((t) => t.id === activeMentor)!;
      return <div key={`${activeMentor}-${line}`} className="training-bubble" role="status" style={{ ['--tail' as string]: `${twin.x - 48}px` }}>
        <strong style={{ color: twin.color }}>{twin.name}</strong>
        <p>{line}</p>
      </div>;
    })()}
    <div className="training-stage-overlay">{children}</div>
    {claiming && <svg className="training-reward-foreground" viewBox="0 0 1440 900" aria-hidden="true" shapeRendering="crispEdges">
      <g transform={`translate(${720 + reward * (rewardTarget.x - 720)} ${520 + reward * (rewardTarget.y - 520) - Math.sin(reward * Math.PI) * 32})`} opacity={rewardElapsed < 900 ? 1 : 1 - (rewardElapsed - 900) / 200}>
        <path d="M-8 -24H8V-8H24V8H8V24H-8V8H-24V-8H-8Z" fill="#FFD23F" stroke="#11162D" strokeWidth="6" />
        <path d="M-4 -16h8v12h12v8H4v12h-8V4h-12V-4h12Z" fill="#FFF6E0" />
      </g>
    </svg>}
  </div>;
}
