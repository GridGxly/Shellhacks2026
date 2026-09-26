// All tunable numbers (PRD §9). Change them here only.

export const PLAYER_HP = 20;
export const ENEMY_HP = 60; // one hand: 3 cards x 20
export const ENEMY_DAMAGE = 4;
export const BOSS_HP = 120; // Encore deals 120 and ends the boss; three cards (60) do not
export const BOSS_DAMAGE = 4;
export const CARD_DAMAGE = 20;
export const ULTIMATE_DAMAGE = 120;
export const HAND_SIZE = 3; // one chord, one rhythm, one scale; each card can land once per fight

// Per-act scaling (act 1 = +0). HP stays inside what one hand can deal at base
// damage (3 cards, plus one Encore for bosses), so no fight can run out of
// actions. Bosses stay at BOSS_HP. Later acts get harder through tempo and damage.
export const ENEMY_HP_PER_ACT = 0;
export const BOSS_HP_PER_ACT = 0;
export const ENEMY_HP_CAP = HAND_SIZE * CARD_DAMAGE;
export const BOSS_HP_CAP = HAND_SIZE * CARD_DAMAGE + ULTIMATE_DAMAGE;
export const DAMAGE_PER_ACT = 1;
export const TEMPO_BASE = 80;
export const TEMPO_PER_FIGHT = 8; // per fight within an act
export const TEMPO_PER_ACT = 8;
export const ENCORE_TEMPO_BASE = 88;
export const ENCORE_TEMPO_PER_ACT = 8;

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

// Score (PRD §7b). lib/score.ts applies these on both the client and the server.
export const SCORE_PER_FLOOR = 1000; // x floor number, per enemy beaten
export const SCORE_PER_HP = 25; // per HP left after each win
export const SCORE_CARD_BASE = 100; // + accuracy% x SCORE_CARD_PER_ACC, per card landed
export const SCORE_CARD_PER_ACC = 2;
export const SCORE_CARD_FAIL = -50;
export const SCORE_ENCORE = 1500;

// Run submission checks (server, PRD §7b anti-cheat)
export const MAX_NOTES_PER_EXERCISE = 64;
export const MAX_ACTIONS_PER_FIGHT = 40;
export const RUN_SUBMIT_COOLDOWN_MS = 60_000;

export const TIPS_START = 120;
// Tavern shows are ephemeral. startAt is the shared downbeat, after the lights/count-in.
export const TAVERN_PASS = 0.8;
export const TAVERN_BUFF_TIPS = 120;
export const TRAINING_BUFF_TIPS = 120; // Gems and I daily reward
export const SESSION_DAYS = 30; // sign-in cookie + session document lifetime
export const LEADERBOARD_SIZE = 50; // rows returned by /api/leaderboard
export const TAVERN_ROOM_TTL_MS = 10 * 60_000;
export const TAVERN_STALE_MS = 8_000;
// One second lets both polling clients prepare before the shared four-second light/count-in beat.
export const TAVERN_START_DELAY_MS = 5_000;
export const TAVERN_PLAYBACK_DELAY_MS = 2_500;
export const TAVERN_DONE_TTL_MS = 30_000;
export const TAVERN_POLL_MS = 700;
export const TAVERN_WAITING_POLL_MS = 1_500;
export const TAVERN_RESULT_MAX_BYTES = 600 * 1024;
export const TAVERN_AUDIO_MAX_BYTES = 400 * 1024;
export const TAVERN_MAX_RECORD_OFFSET_MS = 2_000;
export const TAVERN_HEARTBEAT_MS = 2_000; // polls refresh seenAt at most this often (well under TAVERN_STALE_MS)

// Mentor ("Gems and I") player file, read from MongoDB for signed-in players.
export const MENTOR_RECENT_DAYS = 14; // window for "recent performance" per mode
export const MENTOR_HISTORY_DAYS = 30; // training days looked back on for the streak
export const MENTOR_RECENT_CLIMBS = 5;
// performanceEvents retention: see lib/mongo-indexes.json (TTL on at).
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
  { id: 'encoreDamage', label: 'Encore Damage', color: '#FF4FA3', base: ULTIMATE_DAMAGE, step: 30, max: 150, cost: 100, format: (v) => `${v}`, blurb: 'A landed Encore ends the boss by itself.' },
  { id: 'timingWindow', label: 'Timing Window', color: '#6EC6FF', base: TIMING_WINDOW_MS, step: 25, max: 225, cost: 60, format: (v) => `±${v}MS`, blurb: 'Notes can land a little earlier or later and still count.' },
  { id: 'passLine', label: 'Pass Line', color: '#4CC26B', base: Math.round(PASS_THRESHOLD * 100), step: -5, max: 70, cost: 120, format: (v) => `${v}%`, blurb: 'You need fewer right notes for a card to land.' },
];
