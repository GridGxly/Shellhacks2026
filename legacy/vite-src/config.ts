/**
 * config.ts — ALL tunable numbers for the game (PRD §9).
 *
 * RULE (from the PRD): never hard-code these values anywhere else.
 * Import from here so game balance can be changed in one place.
 *
 * Tags from the PRD:
 *   [Decided] = agreed, don't change without discussion
 *   [Default] = safe placeholder, tune freely by playtesting
 *   [Open]    = still undecided, confirm before relying on it
 */

// --- Combat: health & damage ---
export const PLAYER_HP = 20; // [Decided] player heals to full after each victory
export const ENEMY_HP = 90; // [Decided] regular enemies (nodes 1 & 2)
export const ENEMY_DAMAGE = 4; // [Decided]
export const BOSS_HP = 120; // [Decided]
export const BOSS_DAMAGE = 4; // [Decided] see balance warning in PRD §4
export const CARD_DAMAGE = 30; // [Decided] regular fights; [Open] for boss fight (notes say 90)
export const ULTIMATE_DAMAGE = 120; // [Decided] one clean ultimate kills the boss

// --- Cards & hand ---
export const HAND_SIZE = 3; // [Decided] one chord, one scale, one rhythm
export const BARS_PER_CARD = 3; // [Decided]
export const ULTIMATE_BARS = 8; // [Default] length of the main-song excerpt
export const MIN_POOL_SIZE = 5; // [Default] exercises per card type per level

// --- Timing / audio clock ---
export const COUNT_IN_BEATS = 4; // [Decided] metronome clicks before recording
export const DEFAULT_TEMPO_BPM = 80; // [Default] each exercise may override
export const INPUT_LATENCY_MS = 80; // [Default] fixed mic-delay offset subtracted from onsets
export const RECORD_TAIL_MS = 300; // [Default] keep recording after the last note ends

// --- Pitch detection & grading ---
export const PITCH_POLL_MS = 25; // [Default] how often to read the mic
export const MIN_CLARITY = 0.9; // [Default] Pitchy clarity cutoff (ignore noisier readings)
export const PITCH_TOLERANCE_CENTS = 75; // [Default] how far off-pitch still counts (100 = a full semitone)
export const MIN_PITCH_COVERAGE = 0.6; // [Default] share of a note's readings that must be right
export const TIMING_WINDOW_MS = 150; // [Default] ± allowed onset error
export const ONSET_RMS_RISE = 0.05; // [Open] volume jump that counts as a new note — TUNE ON REAL INSTRUMENT

// --- Pass thresholds ---
export const PASS_THRESHOLD = 0.8; // [Default] share of notes correct to pass a card
export const ULTIMATE_PASS_THRESHOLD = 0.8; // [Default]

// --- UI durations ---
export const REVIEW_DURATION_MS = 1500; // [Default] how long the marked staff + score stays up

// --- Instruments (treble clef only in MVP) ---
// writtenOffset = semitones to add to CONCERT pitch to get the WRITTEN pitch for display.
// Music is stored in concert pitch; grading compares against concert; only display transposes.
export type KeyId = 'C' | 'Bb' | 'Eb' | 'F';

export const INSTRUMENT_KEYS: Record<KeyId, { label: string; writtenOffset: number }> = {
  C: { label: 'C (flute, violin, piano)', writtenOffset: 0 }, // [Open] which keys to offer
  Bb: { label: 'B♭ (trumpet, clarinet, tenor sax)', writtenOffset: 2 },
  Eb: { label: 'E♭ (alto sax)', writtenOffset: 9 },
  F: { label: 'F (french horn)', writtenOffset: 7 },
};
