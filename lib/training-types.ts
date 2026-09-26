import type { InstrumentId } from './content';
import type { Exercise } from './music';
import type { NoteResult } from './mic';

export type TrainingSource = 'gemini' | 'offline';
export type TrainingFocus = 'pitch' | 'rhythm' | 'mixed';
export type TrainingRegiment = {
  mode: 'recommended' | 'custom';
  instrument: InstrumentId;
  concertKey: number;
  spelling: 'sharps' | 'flats';
  focus: TrainingFocus;
  tempo: number;
};
export interface TrainingExercise {
  id: string;
  role: 'drill' | 'final';
  goal: string;
  music: Exercise;
}
export interface TrainingFeedback { source: TrainingSource; castor: string; pollux: string }
export interface TrainingPlan {
  id: string;
  source: TrainingSource;
  fallbackReason?: 'not_configured' | 'unavailable' | 'invalid_response';
  regiment: TrainingRegiment;
  focusSummary: string;
  exercises: TrainingExercise[];
}
export interface TrainingResult {
  exerciseId: string;
  attemptId: string;
  notes: NoteResult[];
  simulated: boolean;
}
export interface TrainingReceipt {
  exerciseId: string;
  attemptId: string;
  hits: number;
  total: number;
  notes: NoteResult[];
  simulated: boolean;
  feedback: TrainingFeedback;
  completedAt: number;
}
export type PerformanceSource = 'adventure' | 'tavern' | 'training';
export interface WeaknessBucket { attempts: number; hits: number }
export interface WeaknessSummary {
  pitches: WeaknessBucket[];
  rhythm: { early: number; steady: number; late: number; unknown: number };
  sources: Record<PerformanceSource, number>;
}
export interface TrainingState {
  day: string;
  resetsAt: number;
  serverNow: number;
  revision: number;
  plan: TrainingPlan | null;
  status: 'ready' | 'active' | 'paused' | 'complete';
  nextIndex: number;
  receipts: TrainingReceipt[];
  activeAttempt?: { id: string; exerciseId: string; startAt: number };
  finalFeedback?: TrainingFeedback;
  claimed: boolean;
  pendingBuff: boolean;
  weaknesses: WeaknessSummary;
}
export interface RewardClaim { runId: string; tavern: boolean; training: boolean; tips: number }
export interface PerformanceInput {
  source: 'adventure' | 'tavern';
  attemptId: string;
  instrument: InstrumentId;
  exercise: Exercise;
  notes: NoteResult[];
  simulated: boolean;
}
