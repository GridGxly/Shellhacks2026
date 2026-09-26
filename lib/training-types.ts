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
/**
 * One stop in the end-of-set review: a single missed note, the twin who
 * explains it, and the beat to pause on. Text is server-generated; the client
 * never supplies speech (see voiceTicket).
 */
export interface ReviewStop {
  exerciseId: string;
  exerciseIndex: number;
  noteIndex: number;
  startBeat: number;
  speaker: 'castor' | 'pollux';
  reason: 'pitch' | 'timing' | 'silent';
  line: string;
  voiceToken?: string;
}
export interface ReviewSummary {
  stops: ReviewStop[];
  perExercise: { exerciseId: string; exerciseIndex: number; role: TrainingExercise['role']; hits: number; total: number }[];
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

/** Accuracy for one mode over the recent window (non-simulated takes only). */
export interface SourceStats { attempts: number; hits: number; notes: number }
/**
 * The mentor's player file (signed-in players; guests keep weaknesses in memory).
 * Assembled from practiceProfiles, performanceEvents, runs and trainingDaily.
 */
export interface MentorProfile {
  username: string;
  weaknesses: WeaknessSummary; // long-term, every mode
  recent: { days: number; bySource: Record<PerformanceSource, SourceStats> };
  climbs: {
    total: number;
    victories: number;
    deepest: number;
    best: { score: number; floor: number } | null;
    favoriteInstrument: InstrumentId | null;
    recent: { floor: number; accuracy: number; instrument: InstrumentId; endedBy: 'loss' | 'victory'; at: number }[];
  };
  training: {
    daysCompleted: number; // within the history window
    streak: number; // consecutive completed UTC days, ending today or yesterday
    today: { status: TrainingState['status']; claimed: boolean; exercisesDone: number } | null;
  };
  generatedAt: number;
}
