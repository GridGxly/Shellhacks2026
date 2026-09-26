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
  activity?: number;
  children?: ReactNode;
}

const asset = (name: string) => `/assets/training/${name}.svg`;
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const finite = (n: number) => Number.isFinite(n) ? n : -1;
const rest = { angle: 0, glow: 0, note: 0, noteProgress: 0 };
const entrance: readonly TrainingPreviewNote[] = [{ atMs: 160, durationMs: 240 }, { atMs: 540, durationMs: 240 }];

/** One clock controls preparation, contact, string vibration, then the released note. */
export function trainingPluck(elapsed: number, notes: readonly TrainingPreviewNote[], side: 0 | 1) {
  if (!Number.isFinite(elapsed) || elapsed < 0) return rest;
  let onset: TrainingPreviewNote | undefined;
  for (let i = side; i < notes.length; i += 2) {
    if (Number.isFinite(notes[i].atMs) && notes[i].atMs <= elapsed + 160) onset = notes[i];
  }
  if (!onset) return rest;
  const age = elapsed - onset.atMs;
  if (age < -160 || age >= 640) return rest;
  const angle = age < -40 ? -28 * clamp((age + 160) / 120)
    : age < 0 ? -28 + 46 * clamp((age + 40) / 40)
      : age < 80 ? 18 : 18 * (1 - clamp((age - 80) / 200));
  const glow = age >= 0 ? 1 - clamp(age / Math.max(180, Math.min(400, finite(onset.durationMs)))) : 0;
  const noteProgress = clamp((age - 40) / 600);
  return { angle: Math.round(angle / 2) * 2, glow, note: age >= 40 ? 1 - noteProgress : 0, noteProgress };
}

export default function TrainingStage({ phase, activeMentor = null, introElapsed = -1, playbackElapsed = -1, previewNotes = [], rewardElapsed = -1, activity = 0, children }: TrainingStageProps) {
  const entering = phase === 'welcome' && finite(introElapsed) >= 0 && introElapsed < 1200;
  const playing = phase === 'preview' && finite(playbackElapsed) >= 0;
  const notes = entering ? entrance : previewNotes;
  const elapsed = entering ? introElapsed : playing ? playbackElapsed : -1;
  const plucks = [trainingPluck(elapsed, notes, 0), trainingPluck(elapsed, notes, 1)];
  const claiming = phase === 'complete' && finite(rewardElapsed) >= 0 && rewardElapsed < 1100;
  const rewardProgress = clamp(rewardElapsed / 900);
  const input = phase === 'performing' && Number.isFinite(activity) ? clamp(activity) : 0;

  return <div className="training-stage" data-phase={phase}>
    <svg className="training-stage-art" viewBox="0 0 1440 900" width="1440" height="900" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <image href={asset('courtyard')} width="1440" height="900" />
      <image href={asset('standards')} width="1440" height="440" />
      <image href={asset('column-left')} x="112" y="168" width="144" height="408" />
      <image href={asset('column-right')} x="1184" y="168" width="144" height="408" />
      {[280, 1104].map((x, side) => <g key={x}>
        <path className="training-torch-glow" d={`M${x - 44} 340h144v112H${x - 44}Z`} fill="#FFD23F" opacity=".035" />
        <image href={asset(side ? 'brazier-right' : 'brazier-left')} x={x} y="356" width="56" height="140" />
        <path className="training-torch-spark" d={`M${x + 24} 346h8v8h-8Z`} fill="#FFD23F" />
      </g>)}
      <path d="M448 532h232v24H448Zm316 0h232v24H764Z" fill="#11162D" opacity=".7" />
      {(['castor', 'pollux'] as const).map((mentor, side) => <g key={mentor} data-mentor={mentor}>
        <image href={asset(mentor)} x={side ? 800 : 472} y="272" width="176" height="280" />
        <g className="training-mentor-label" transform={`translate(${side ? 780 : 452} 244)`}>
          <path d="M4 0h216v4h4v28h-4v4H4v-4H0V4h4Z" fill="#11162D" />
          <text x="112" y="26" textAnchor="middle" fill={side ? '#FF4FA3' : '#FFD23F'}>{mentor.toUpperCase()}</text>
          {activeMentor === mentor && <path d="M100 -16h24v4h-4v4h-4v4h-8v-4h-4v-4h-4Z" fill={side ? '#FF4FA3' : '#FFD23F'} />}
        </g>
      </g>)}
      <image href={asset('harmonic-canon')} x="432" y="428" width="576" height="208" />
      {plucks.map((pluck, side) => <g key={side} data-playing-side={side}>
        <g className="training-string-glow training-motion" opacity={pluck.glow}>
          {[476, 480, 484].map(y => <path key={y} d={`M${side ? 740 : 480} ${y}h220`} stroke={side ? '#FF4FA3' : '#FFD23F'} strokeWidth="2" />)}
          <path d={`M${side ? 812 : 628} 470h8v20h-8Zm-8 8h24v4h-24Z`} fill="#FFF6E0" />
        </g>
        <g transform={side ? 'translate(976 272) scale(-1 1)' : 'translate(472 272)'}>
          <g className="training-playing-arm" transform={`rotate(${pluck.angle || (phase === 'feedback' && activeMentor === (side ? 'pollux' : 'castor') ? -14 : 0)} 116 146)`}>
            <path d="M108 136H124V156H140V168H164V188H128V176H112Z" fill={side ? '#BD8766' : '#DDAA7C'} />
            <path d="M152 168h12v8h-12Z" fill={side ? '#DDAA7C' : '#F0C397'} />
          </g>
        </g>
        <g className="training-released-note training-motion" opacity={pluck.note} transform={`translate(${(side ? 816 : 632) + (side ? 1 : -1) * pluck.noteProgress * 40} ${480 - pluck.noteProgress * 168})`} fill={side ? '#FF4FA3' : '#FFD23F'}>
          <path d="M0 0h8v-28h16v8H8V8H-8V0Z" />
          <path d="M-20 -20h4v4h-4Zm36 16h4v4h-4Z" opacity=".65" />
        </g>
      </g>)}
      <g className="training-instrument-label" transform="translate(448 642)">
        <path d="M4 0h536v4h4v32h-4v4H4v-4H0V4h4Z" fill="#11162D" />
        <text x="272" y="28" textAnchor="middle" fill="#F0DDB4">HARMONIC CANON II</text>
      </g>
      {phase === 'performing' && <g className="training-input-meter" transform="translate(656 368)">
        <path d="M0 0h128v48H0Z" fill="#11162D" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <path key={i} d={`M${8 + i * 14} 8h10v16h-10Z`} fill={input > i / 8 ? '#6EC6FF' : '#30334E'} />)}
        <text x="64" y="40" textAnchor="middle" fill="#6EC6FF">YOUR INPUT</text>
      </g>}
      {claiming && <g className="training-reward-star training-motion" transform={`translate(${720 + rewardProgress * 340} ${520 + rewardProgress * 220 - Math.sin(rewardProgress * Math.PI) * 32})`} opacity={rewardElapsed < 900 ? 1 : 1 - (rewardElapsed - 900) / 200}>
        <path d="M-8 -24H8V-8H24V8H8V24H-8V8H-24V-8H-8Z" fill="#7B572F" stroke="#11162D" strokeWidth="8" />
        <path d="M-8 -24H8V-8H24V8H8V24H-8V8H-24V-8H-8Z" fill="#FFD23F" />
        <path d="M-4 -16h8v12h12v8H4v12h-8V4h-12V-4h12Z" fill="#FFF6E0" />
      </g>}
    </svg>
    <div className="training-stage-overlay">{children}</div>
  </div>;
}
