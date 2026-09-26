// All tunable numbers (PRD §9). Change them here only.

export const PLAYER_HP = 20;
export const ENEMY_HP = 90;
export const ENEMY_DAMAGE = 4;
export const BOSS_HP = 150; // cards (3 x 30) + Encore (120) = 210, so Encore alone no longer one-shots
export const BOSS_DAMAGE = 4;
export const CARD_DAMAGE = 30;
export const ULTIMATE_DAMAGE = 120;

export const COUNT_IN_BEATS = 4;
export const PITCH_TOLERANCE_CENTS = 50;
export const MIN_PITCH_COVERAGE = 0.5;
export const TIMING_WINDOW_MS = 150;
export const PERFECT_MS = 50; // onset within this of the beat = PERFECT; beyond it EARLY / LATE
export const INPUT_LATENCY_MS = 80;
export const RECORD_TAIL_MS = 300;
export const PASS_THRESHOLD = 0.8;
export const ULTIMATE_PASS_THRESHOLD = 0.8;
export const REVIEW_DURATION_MS = 2200;
export const ONSET_RISE_DB = 6;
export const SKIP_ATTACK = 0.2; // ignore this share of each note's window when judging pitch (previous note still ringing)
export const MIN_READINGS = 2; // fewer pitched frames than this in a note's window = silent
export const IGNORE_OCTAVE = true; // grade the note name only: a C in any octave counts as C

export const TIPS_START = 120;
export const TIPS_PER_WIN = 40;
export const ACT_BONUS_TIPS = 60; // extra tips for beating an act boss
export const ACT_BONUS_SCORE = 2500;
export const XP_PER_WIN = 40;
export const XP_PER_LEVEL = 100;

// Trash talk (PRD §7a)
export const TAUNT_TIMEOUT_MS = 1400;
export const LOW_HP_TAUNT = 8;
export const TAUNT_ON_HIT_CHANCE = 0.33;

export type StatId = 'maxHp' | 'cardDamage' | 'encoreDamage' | 'timingWindow' | 'passLine';

export interface StatDef {
  id: StatId;
  label: string;
  color: string;
  base: number;
  step: number;
  max: number;
  cost: number;
  format: (v: number) => string;
  blurb: string;
}

export const STATS: StatDef[] = [
  { id: 'maxHp', label: 'Max HP', color: '#E8434F', base: PLAYER_HP, step: 4, max: 32, cost: 60, format: (v) => `${v}`, blurb: 'More room for mistakes. Heals to the new max.' },
  { id: 'cardDamage', label: 'Card Damage', color: '#FFD23F', base: CARD_DAMAGE, step: 5, max: 45, cost: 80, format: (v) => `${v}`, blurb: 'Every card that lands hits 5 harder.' },
  { id: 'encoreDamage', label: 'Encore Damage', color: '#FF4FA3', base: ULTIMATE_DAMAGE, step: 30, max: 150, cost: 100, format: (v) => `${v}`, blurb: 'At 150 the Encore ends the boss in one shot.' },
  { id: 'timingWindow', label: 'Timing Window', color: '#6EC6FF', base: TIMING_WINDOW_MS, step: 25, max: 225, cost: 60, format: (v) => `±${v}MS`, blurb: 'Notes can land a little earlier or later and still count.' },
  { id: 'passLine', label: 'Pass Line', color: '#4CC26B', base: 80, step: -5, max: 70, cost: 120, format: (v) => `${v}%`, blurb: 'You need fewer right notes for a card to land.' },
];
