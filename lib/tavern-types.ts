import type { NoteResult } from './mic';
import type { InstrumentId } from './content';
import type { TavernCharacterId } from './tavern-characters';

export type TavernPart = 'A' | 'B';
export type TavernMode = 'duet' | 'pvp';
export type TavernPhase = 'waiting' | 'ready' | 'countdown' | 'results' | 'done' | 'gone';
export interface PublicTavernResult {
  hits: number;
  total: number;
  offsetMs: number;
  mime?: string;
  hasAudio: boolean;
  hitIndices?: number[];
}
export interface PublicTavernPlayer {
  name: string;
  instrument: InstrumentId;
  characterId: TavernCharacterId;
  part: TavernPart;
  result?: PublicTavernResult;
}
export interface PublicTavernRoom {
  code: string;
  mode: TavernMode;
  phase: TavernPhase;
  host: PublicTavernPlayer;
  guest: PublicTavernPlayer | null;
  startAt?: number;
  playbackAt?: number;
  serverNow: number;
  partnerStale: boolean;
  pass?: boolean;
  /** PvP only: null is a draw; absent until both takes are scored. */
  winnerPart?: TavernPart | null;
}
export interface TavernEntry {
  code: string;
  token: string;
  part: TavernPart;
  mode: TavernMode;
  serverNow: number;
}
export interface TavernResultInput {
  notes: NoteResult[];
  simulated: boolean;
  hits: number;
  total: number;
  offsetMs: number;
  mime?: string; // set when the recording itself follows in the binary upload (lib/tavern.ts takeBody)
  hitIndices?: number[];
}
