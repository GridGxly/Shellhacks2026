'use client';
import { create } from 'zustand';
import { ACT_BONUS_SCORE, ACT_BONUS_TIPS, STATS, TIPS_PER_WIN, TIPS_START, XP_PER_LEVEL, XP_PER_WIN, LOW_HP_TAUNT, type StatId } from './config';
import { ENEMIES, INSTRUMENTS, type InstrumentId } from './content';
import { makeExercise, ODE_TO_JOY, type CardType, type Exercise } from './music';

export type Screen =
  | 'title' | 'howto' | 'mic' | 'credits' | 'instrument' | 'map' | 'combat'
  | 'victory' | 'actclear' | 'loss' | 'final' | 'leaderboard' | 'profile';
export type Overlay = null | 'stats' | 'pause' | 'mappeek' | 'signin' | 'overwrite';
export type Transition = null | 'wipe' | 'iris';

export interface Card {
  type: CardType;
  exercise: Exercise;
  landed: boolean;
  fails: number;
}

export interface Combat {
  enemyIdx: number;
  enemyHp: number;
  round: number;
  hand: Card[];
  heat: 0 | 1 | 2 | 3;
  failStreak: number;
  used: string[];
  encore: { charged: boolean; failedOnce: boolean } | null;
  encoreExercise: Exercise;
}

export interface RunStats {
  notesHit: number;
  notesTotal: number;
  cardsLanded: number;
  cardsFailed: number;
  rounds: number;
  encoresLanded: number;
}

export interface Run {
  instrument: InstrumentId;
  hp: number;
  tips: number;
  xp: number;
  levels: Record<StatId, number>;
  floor: number; // enemies beaten, 0..18
  score: number;
  stats: RunStats;
  startedAt: number;
}

export interface User {
  username: string;
  level: number;
  rank?: number;
}

const SAVE_KEY = 'stc.save.v1';
const BEST_KEY = 'stc.best.v1';

const freshLevels = (): Record<StatId, number> => ({ maxHp: 0, cardDamage: 0, encoreDamage: 0, timingWindow: 0, passLine: 0 });

export function stat(run: Run, id: StatId) {
  const d = STATS.find((s) => s.id === id)!;
  return d.base + d.step * run.levels[id];
}
export const level = (run: Run) => 1 + Math.floor(run.xp / XP_PER_LEVEL);
export function canAfford(run: Run, id: StatId) {
  const d = STATS.find((s) => s.id === id)!;
  const v = stat(run, id);
  const maxed = d.step > 0 ? v >= d.max : v <= d.max;
  return { maxed, affordable: !maxed && run.tips >= d.cost, cost: d.cost };
}
export const accuracy = (s: RunStats) => (s.notesTotal ? Math.round((s.notesHit / s.notesTotal) * 100) : 0);

function freshRun(instrument: InstrumentId = 'trumpet'): Run {
  return {
    instrument,
    hp: STATS[0].base,
    tips: TIPS_START,
    xp: 0,
    levels: freshLevels(),
    floor: 0,
    score: 0,
    stats: { notesHit: 0, notesTotal: 0, cardsLanded: 0, cardsFailed: 0, rounds: 0, encoresLanded: 0 },
    startedAt: Date.now(),
  };
}

function newCombat(enemyIdx: number): Combat {
  const enemy = ENEMIES[enemyIdx];
  const types: CardType[] = ['chord', 'rhythm', 'scale'];
  return {
    enemyIdx,
    enemyHp: enemy.hp,
    round: 1,
    hand: types.map((type) => ({ type, exercise: makeExercise(type, enemy.tempo), landed: false, fails: 0 })),
    heat: 0,
    failStreak: 0,
    used: [],
    encore: enemy.boss ? { charged: true, failedOnce: false } : null,
    encoreExercise: { ...ODE_TO_JOY, tempo: 88 + enemy.act * 8 },
  };
}

function readJSON<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: the game still runs */
  }
}

async function syncSave(run: Run | null) {
  try {
    await fetch('/api/save', {
      method: run ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: run ? JSON.stringify({ run }) : undefined,
    });
  } catch {
    /* offline or DB not configured */
  }
}

interface GameState {
  screen: Screen;
  overlay: Overlay;
  transition: Transition;
  run: Run;
  combat: Combat | null;
  demoMode: boolean;
  lossBy: number | null;
  saved: Run | null;
  best: { score: number; floor: number } | null;
  user: User | null;
  toast: string | null;

  hydrate: () => void;
  setUser: (u: User | null) => void;
  go: (screen: Screen, transition?: Transition) => void;
  setOverlay: (o: Overlay) => void;
  setDemo: (v: boolean) => void;
  chooseInstrument: (id: InstrumentId) => void;
  newRun: () => void;
  continueRun: () => void;
  startFight: () => void;
  buy: (id: StatId) => boolean;
  showToast: (t: string) => void;

  resolveCard: (cardIdx: number, pass: boolean, hits: number, total: number) => void;
  resolveEncore: (pass: boolean, hits: number, total: number) => void;
  damageEnemy: (amount: number) => void;
  enemyHitsPlayer: () => number;
  nextRound: () => void;
  noteTaunt: (id: string) => void;
  winFight: () => void;
  loseRun: () => void;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  overlay: null,
  transition: null,
  run: freshRun(),
  combat: null,
  demoMode: false,
  lossBy: null,
  saved: null,
  best: null,
  user: null,
  toast: null,

  hydrate: () => set({ saved: readJSON<Run>(SAVE_KEY), best: readJSON(BEST_KEY) }),
  setUser: (user) => set({ user }),

  go: (screen, transition = 'wipe') => {
    if (!transition) return set({ screen, overlay: null });
    set({ transition });
    window.setTimeout(() => set({ screen, overlay: null }), transition === 'iris' ? 520 : 380);
    window.setTimeout(() => set({ transition: null }), transition === 'iris' ? 1100 : 800);
  },
  setOverlay: (overlay) => set({ overlay }),
  setDemo: (demoMode) => set({ demoMode }),
  chooseInstrument: (id) => set((s) => ({ run: { ...s.run, instrument: id } })),

  newRun: () => {
    writeJSON(SAVE_KEY, null);
    if (get().user) void syncSave(null);
    set((s) => ({ run: freshRun(s.run.instrument), combat: null, lossBy: null, saved: null }));
  },
  continueRun: () => {
    const saved = get().saved;
    if (saved) set({ run: saved, combat: null });
  },

  startFight: () => set((s) => ({ combat: newCombat(s.run.floor) })),

  buy: (id) => {
    const { run } = get();
    const { affordable, cost } = canAfford(run, id);
    if (!affordable) return false;
    const levels = { ...run.levels, [id]: run.levels[id] + 1 };
    const next: Run = { ...run, tips: run.tips - cost, levels };
    if (id === 'maxHp') next.hp = stat(next, 'maxHp');
    set({ run: next });
    writeJSON(SAVE_KEY, next);
    return true;
  },

  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 3200);
  },

  resolveCard: (cardIdx, pass, hits, total) =>
    set((s) => {
      const c = s.combat!;
      const hand = c.hand.map((card, i) =>
        i === cardIdx ? { ...card, landed: pass || card.landed, fails: card.fails + (pass ? 0 : 1) } : card,
      );
      const failStreak = pass ? 0 : c.failStreak + 1;
      let heat = Math.max(0, Math.min(3, c.heat + (pass ? -1 : 1))) as Combat['heat'];
      if (failStreak >= 2 || (!pass && s.run.hp <= LOW_HP_TAUNT)) heat = 3;
      let encore = c.encore;
      if (encore && hand.every((h) => h.landed)) encore = { ...encore, charged: true };
      const acc = total ? (hits / total) * 100 : 0;
      return {
        combat: { ...c, hand, failStreak, heat, encore },
        run: {
          ...s.run,
          score: Math.max(0, s.run.score + (pass ? Math.round(100 + acc * 2) : -50)),
          stats: {
            ...s.run.stats,
            notesHit: s.run.stats.notesHit + hits,
            notesTotal: s.run.stats.notesTotal + total,
            cardsLanded: s.run.stats.cardsLanded + (pass ? 1 : 0),
            cardsFailed: s.run.stats.cardsFailed + (pass ? 0 : 1),
          },
        },
      };
    }),

  resolveEncore: (pass, hits, total) =>
    set((s) => {
      const c = s.combat!;
      const allLanded = c.hand.every((h) => h.landed);
      const failStreak = pass ? 0 : c.failStreak + 1;
      const heat = (pass ? Math.max(0, c.heat - 1) : Math.min(3, c.heat + 1)) as Combat['heat'];
      return {
        combat: {
          ...c,
          failStreak,
          heat: failStreak >= 2 ? 3 : heat,
          encore: { failedOnce: c.encore!.failedOnce || !pass, charged: pass ? false : allLanded },
        },
        run: {
          ...s.run,
          score: s.run.score + (pass ? 1500 : 0),
          stats: {
            ...s.run.stats,
            notesHit: s.run.stats.notesHit + hits,
            notesTotal: s.run.stats.notesTotal + total,
            encoresLanded: s.run.stats.encoresLanded + (pass ? 1 : 0),
          },
        },
      };
    }),

  damageEnemy: (amount) => set((s) => ({ combat: { ...s.combat!, enemyHp: Math.max(0, s.combat!.enemyHp - amount) } })),

  enemyHitsPlayer: () => {
    const dmg = ENEMIES[get().combat!.enemyIdx].damage;
    set((s) => ({ run: { ...s.run, hp: Math.max(0, s.run.hp - dmg) } }));
    return get().run.hp;
  },

  nextRound: () =>
    set((s) => {
      const c = s.combat!;
      const tempo = ENEMIES[c.enemyIdx].tempo;
      return {
        combat: {
          ...c,
          round: c.round + 1,
          hand: c.hand.map((card) => (card.landed ? card : { ...card, exercise: makeExercise(card.type, tempo) })),
        },
        run: { ...s.run, stats: { ...s.run.stats, rounds: s.run.stats.rounds + 1 } },
      };
    }),

  noteTaunt: (id) => set((s) => ({ combat: s.combat && { ...s.combat, used: [...s.combat.used, id] } })),

  winFight: () => {
    const s = get();
    logFight(s, true);
    const floor = s.run.floor + 1;
    const boss = ENEMIES[floor - 1].boss;
    const run: Run = {
      ...s.run,
      floor,
      tips: s.run.tips + TIPS_PER_WIN + (boss ? ACT_BONUS_TIPS : 0),
      xp: s.run.xp + XP_PER_WIN,
      score: s.run.score + 1000 * floor + 25 * s.run.hp + (boss ? ACT_BONUS_SCORE : 0),
      hp: stat(s.run, 'maxHp'),
    };
    set({ run });
    if (floor < ENEMIES.length) {
      writeJSON(SAVE_KEY, run);
      set({ saved: run });
      if (s.user) void syncSave(run);
    } else {
      finishRun(run, 'victory');
    }
  },

  loseRun: () => {
    const s = get();
    logFight(s, false);
    set({ lossBy: s.combat?.enemyIdx ?? 0 });
    finishRun(s.run, 'loss');
  },
}));

/** Anonymous per-fight record for the bestiary danger stats (no-op without a database). */
function logFight(s: GameState, won: boolean) {
  const c = s.combat;
  if (!c) return;
  void fetch('/api/fights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enemyId: ENEMIES[c.enemyIdx].id, won, accuracy: accuracy(s.run.stats), rounds: c.round, instrument: s.run.instrument }),
  }).catch(() => {});
}

function finishRun(run: Run, endedBy: 'loss' | 'victory') {
  writeJSON(SAVE_KEY, null);
  const best = readJSON<{ score: number; floor: number }>(BEST_KEY);
  if (!best || run.score > best.score) writeJSON(BEST_KEY, { score: run.score, floor: run.floor });
  useGame.setState({ saved: null, best: readJSON(BEST_KEY) });
  if (useGame.getState().user) {
    void syncSave(null);
    void fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run, endedBy }),
    }).catch(() => {});
  }
}

export const instrumentOf = (run: Run) => INSTRUMENTS.find((i) => i.id === run.instrument)!;
