/**
 * types.ts — the shared data model (PRD §8).
 *
 * These types are the contracts every part of the game agrees on:
 * content authors write Exercises, the notation code renders them,
 * the audio code grades them into NoteResults, and the store tracks
 * the whole run. If a shape needs to change, change it HERE so every
 * file that touches it updates together.
 */

import type { KeyId } from './config';

// -------- Music (source of truth = a list of notes) --------

export type CardType = 'chord' | 'scale' | 'rhythm';

/** A single note, stored in CONCERT pitch. Written pitch is derived only for display. */
export interface Note {
  midi: number; // concert pitch as a MIDI number (e.g. 60 = middle C)
  startBeat: number; // beats from the start of the exercise (after the count-in)
  durBeats: number; // how many beats the note lasts
}

/** One short playable exercise: a few bars of music at a tempo. */
export interface Exercise {
  id: string;
  tempo: number; // BPM
  timeSig: [number, number]; // e.g. [4, 4]
  notes: Note[];
}

/** A level = one map node, with pools of exercises to draw from each round. */
export interface Level {
  nodeId: string;
  pools: Record<CardType, Exercise[]>; // a fresh exercise is drawn per card each round
  ultimate?: Exercise; // boss only: the main-song excerpt for the ultimate
}

/** The grade for one note after a recording. */
export interface NoteResult {
  index: number; // which note in the exercise
  correct: boolean;
  playedMidi: number | null; // what was actually heard; null = silent
  onsetOffsetMs: number | null; // how early/late the onset was; null = no onset detected
}

// -------- Screens & game state (PRD §8) --------

export type Screen =
  | 'title'
  | 'keySelect'
  | 'map'
  | 'combat'
  | 'victory'
  | 'finalVictory'
  | 'loss';

export type NodeType = 'enemy' | 'boss';
export type NodeStatus = 'locked' | 'available' | 'beaten';

export interface MapNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
}

export type CombatPhase =
  | 'playerTurn'
  | 'recording'
  | 'review'
  | 'enemyTurn'
  | 'over';

/** A card currently in the hand. `exercise` is refreshed each round. */
export interface HandCard {
  type: CardType;
  exercise: Exercise;
}

export interface UltimateState {
  enabled: boolean;
  charged: boolean;
  failedOnce: boolean;
}

export type ActiveAction =
  | { kind: 'card'; index: number }
  | { kind: 'ultimate' }
  | null;

export interface CombatState {
  enemyHp: number;
  enemyMaxHp: number;
  enemyIntent: number; // damage the enemy will deal, shown above its head
  round: number;
  hand: HandCard[]; // cards not yet passed
  ultimate: UltimateState | null; // null for regular enemies
  activeAction: ActiveAction;
  phase: CombatPhase;
}

export interface GameState {
  screen: Screen;
  instrumentKey: KeyId | null;
  playerHp: number; // reset to PLAYER_HP after each victory
  nodes: MapNode[];
  currentNodeId: string | null;
  combat: CombatState | null;
  lastResult: NoteResult[] | null;

  // actions
  setScreen: (screen: Screen) => void; // navigate between screens
  selectKey: (key: KeyId) => void; // store instrument key, then go to the map
  resetRun: () => void; // used by "Continue" (loss) and "Start New Adventure"
}
