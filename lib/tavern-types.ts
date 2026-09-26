import type { NoteResult } from './mic';
import type { InstrumentId } from './content';

export type TavernPart = 'A' | 'B';
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
  part: TavernPart;
  result?: PublicTavernResult;
}
export interface PublicTavernRoom {
  code: string;
  phase: TavernPhase;
  host: PublicTavernPlayer;
  guest: PublicTavernPlayer | null;
  startAt?: number;
  playbackAt?: number;
  serverNow: number;
  partnerStale: boolean;
  pass?: boolean;
}
export interface TavernEntry {
  code: string;
  token: string;
  part: TavernPart;
  serverNow: number;
}
export interface TavernResultInput {
  notes: NoteResult[];
  simulated: boolean;
  hits: number;
  total: number;
  offsetMs: number;
  audio?: string;
  mime?: string;
  hitIndices?: number[];
}
