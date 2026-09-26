'use client';
import { create } from 'zustand';
import { ACT_BONUS_TIPS, ENCORE_TEMPO_BASE, ENCORE_TEMPO_PER_ACT, STATS, TAVERN_BUFF_TIPS, TIPS_PER_WIN, TIPS_START, XP_PER_LEVEL, XP_PER_WIN, LOW_HP_TAUNT, type StatId } from './config';
import { ENEMIES, INSTRUMENTS, type InstrumentId } from './content';
import { exerciseKey, makeExercise, GRAN_VALS, type CardType, type Exercise } from './music';
import { addScore, type RunEvent } from './score';
import { resetTrainingMemory } from './training';
import { TRAINING_BUFF_TIPS } from './training-core';
import type { RewardClaim } from './training-types';

export type Screen =
  | 'title' | 'howto' | 'mic' | 'lab' | 'bossdemo' | 'credits' | 'instrument' | 'map' | 'combat'
  | 'victory' | 'actclear' | 'loss' | 'final' | 'leaderboard' | 'profile' | 'tavern' | 'training';
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
  seen: string[]; // exerciseKey of every exercise dealt this fight (no repeats)
  hits: number; // fight-local note counts (the danger stats want this fight only)
  total: number;
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
  id: string; // server dedupes submissions by this
  instrument: InstrumentId;
  hp: number;
  tips: number;
  xp: number;
  levels: Record<StatId, number>;
  floor: number; // enemies beaten, 0..18
  score: number;
  stats: RunStats;
  startedAt: number;
  demo: boolean; // any action graded by the simulator: the run is practice, not ranked
  log: RunEvent[]; // every scored action; the server recomputes the score from it
}

export interface User {
  username: string;
  level: number;
  rank?: number;
  tavernBuff?: boolean;
  trainingBuff?: boolean;
}

const SAVE_KEY = 'stc.save.v1';
const BEST_KEY = 'stc.best.v1';
const PENDING_KEY = 'stc.pending.v1'; // a finished run the server hasn't acknowledged yet
const REWARD_KEY = 'stc.reward-start.v1';
let rewardStarting = false;
interface PendingRewardStart { username: string; run: Run }
// Keep retries safe within this tab even when browser storage is unavailable.
// A null entry also prevents a failed storage removal from reviving a used id.
const pendingRewardStarts = new Map<string, PendingRewardStart | null>();
const rewardAccount = (username: string) => username.toLowerCase();
const rewardStorageKey = (username: string) => `${REWARD_KEY}:${rewardAccount(username)}`;

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

const newRunId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function freshRun(instrument: InstrumentId = 'trumpet'): Run {
  return {
    id: newRunId(),
    instrument,
    hp: STATS[0].base,
    tips: TIPS_START,
    xp: 0,
    levels: freshLevels(),
    floor: 0,
    score: 0,
    stats: { notesHit: 0, notesTotal: 0, cardsLanded: 0, cardsFailed: 0, rounds: 0, encoresLanded: 0 },
    startedAt: Date.now(),
    demo: false,
    log: [],
  };
}

/** Saves from before run ids/logs existed still load. */
function migrateRun(r: Run | null): Run | null {
  if (!r) return null;
  return { ...r, id: r.id ?? newRunId(), demo: r.demo ?? false, log: Array.isArray(r.log) ? r.log : [] };
}

/** A new exercise whose notes weren't already dealt this fight (a few tries, then accept). */
function freshExercise(type: CardType, tempo: number, seen: string[]): Exercise {
  let ex = makeExercise(type, tempo);
  for (let i = 0; i < 12 && seen.includes(exerciseKey(ex)); i++) ex = makeExercise(type, tempo);
  seen.push(exerciseKey(ex));
  return ex;
}

function newCombat(enemyIdx: number): Combat {
  const enemy = ENEMIES[enemyIdx];
  const types: CardType[] = ['chord', 'rhythm', 'scale'];
  const seen: string[] = [];
  return {
    enemyIdx,
    enemyHp: enemy.hp,
    round: 1,
    hand: types.map((type) => ({ type, exercise: freshExercise(type, enemy.tempo, seen), landed: false, fails: 0 })),
    heat: 0,
    failStreak: 0,
    used: [],
    encore: enemy.boss ? { charged: true, failedOnce: false } : null,
    encoreExercise: { ...GRAN_VALS, tempo: ENCORE_TEMPO_BASE + ENCORE_TEMPO_PER_ACT * enemy.act },
    seen,
    hits: 0,
    total: 0,
  };
}

/** The floor number of the fight in progress (1..18). */
const fightFloor = (run: Run) => run.floor + 1;

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

function readRewardStart(username: string): PendingRewardStart | null {
  const account = rewardAccount(username);
  if (pendingRewardStarts.has(account)) return pendingRewardStarts.get(account) ?? null;
  const saved = readJSON<PendingRewardStart>(rewardStorageKey(username));
  const legacy = readJSON<PendingRewardStart>(REWARD_KEY);
  const previous = [saved, legacy].find(record =>
    typeof record?.username === 'string' && rewardAccount(record.username) === account &&
    typeof record.run?.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(record.run.id) &&
    INSTRUMENTS.some(instrument => instrument.id === record.run.instrument));
  if (!previous) return null;
  // Only a fresh climb is resumed here; never restore altered tips or levels.
  const run = { ...freshRun(previous.run.instrument), id: previous.run.id };
  if (Number.isFinite(previous.run.startedAt)) run.startedAt = previous.run.startedAt;
  const pending = { username, run };
  pendingRewardStarts.set(account, pending);
  return pending;
}

function saveRewardStart(username: string, run: Run) {
  const pending = { username, run };
  pendingRewardStarts.set(rewardAccount(username), pending);
  writeJSON(rewardStorageKey(username), pending);
}

function clearRewardStart(username: string) {
  pendingRewardStarts.set(rewardAccount(username), null);
  writeJSON(rewardStorageKey(username), null);
  const legacy = readJSON<PendingRewardStart>(REWARD_KEY);
  if (typeof legacy?.username === 'string' && rewardAccount(legacy.username) === rewardAccount(username)) writeJSON(REWARD_KEY, null);
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
  tavernBuff: boolean; // guests keep this only in memory; accounts claim the server's boolean
  trainingBuff: boolean;
  startingRun: boolean;
  viewProfile: string | null;
  toast: string | null;
  combatLocked: boolean; // a performance/attack/enemy turn is running: no pause overlays
  // Set during a Boss Demo fight: the real run + checkpoint to hand back after.
  bossDemo: { run: Run; saved: Run | null } | null;

  hydrate: () => void;
  setUser: (u: User | null) => void;
  go: (screen: Screen, transition?: Transition) => void;
  setOverlay: (o: Overlay) => void;
  setDemo: (v: boolean) => void;
  chooseInstrument: (id: InstrumentId) => void;
  newRun: () => Promise<boolean>;
  continueRun: () => void;
  adoptSave: (run: Run) => void;
  startFight: () => void;
  startBossDemo: (enemyIdx: number) => void;
  endBossDemo: () => void;
  buy: (id: StatId) => boolean;
  showToast: (t: string) => void;

  resolveCard: (cardIdx: number, pass: boolean, hits: number, total: number, simulated: boolean) => void;
  resolveEncore: (pass: boolean, hits: number, total: number, simulated: boolean) => void;
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
  tavernBuff: false,
  trainingBuff: false,
  startingRun: false,
  viewProfile: null,
  toast: null,
  combatLocked: false,
  bossDemo: null,

  hydrate: () => set({ saved: migrateRun(readJSON<Run>(SAVE_KEY)), best: readJSON(BEST_KEY) }),
  setUser: (user) => {
    resetTrainingMemory(user?.username ?? null);
    set((previous) => ({ user, tavernBuff: user ? user.tavernBuff === true : previous.user ? false : previous.tavernBuff, trainingBuff: user ? user.trainingBuff === true : previous.user ? false : previous.trainingBuff }));
    if (user) void flushPending();
  },

  go: (screen, transition = 'wipe') => {
    if (screen !== 'profile') set({ viewProfile: null });
    if (!transition) return set({ screen, overlay: null });
    set({ transition });
    window.setTimeout(() => set({ screen, overlay: null }), transition === 'iris' ? 520 : 380);
    window.setTimeout(() => set({ transition: null }), transition === 'iris' ? 1100 : 800);
  },
  setOverlay: (overlay) => set({ overlay }),
  setDemo: (demoMode) => set({ demoMode }),
  chooseInstrument: (id) => set((s) => ({ run: { ...s.run, instrument: id } })),

  newRun: async () => {
    if (rewardStarting || get().transition) return false;
    rewardStarting = true; set({ startingRun: true });
    const { user, tavernBuff, trainingBuff } = get();
    let run = freshRun(get().run.instrument);
    let tips = 0;
    let pending = { tavernBuff: false, trainingBuff: false };
    try {
      if (!user) {
        // Yield with the guard held so simultaneous guest clicks share the same
        // protection as the account request instead of replacing its bonus run.
        await Promise.resolve();
        if (get().user) return false;
        tips = (tavernBuff ? TAVERN_BUFF_TIPS : 0) + (trainingBuff ? TRAINING_BUFF_TIPS : 0);
      } else {
        // Each account retains its own id after a lost response or sign-out.
        // Another account or a guest climb must not discard that receipt.
        const previous = readRewardStart(user.username);
        if (previous) run = previous.run;
        saveRewardStart(user.username, run);
        const response = await fetch('/api/rewards/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: run.id }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Reward confirmation unavailable');
        const receipt = await response.json() as RewardClaim;
        if (receipt.runId !== run.id || typeof receipt.tavern !== 'boolean' || typeof receipt.training !== 'boolean' || receipt.tips !== (receipt.tavern ? TAVERN_BUFF_TIPS : 0) + (receipt.training ? TRAINING_BUFF_TIPS : 0)) throw new Error('Invalid reward confirmation');
        if (get().user?.username !== user.username) return false;
        tips = receipt.tips;
        pending = { tavernBuff: tavernBuff && !receipt.tavern, trainingBuff: trainingBuff && !receipt.training };
        const me = await fetch('/api/me', { signal: AbortSignal.timeout(4000), cache: 'no-store' }).then(r => r.ok ? r.json() as Promise<User | null> : null).catch(() => null);
        if (get().user?.username !== user.username) return false;
        if (me?.username === user.username) pending = { tavernBuff: me.tavernBuff === true, trainingBuff: me.trainingBuff === true };
      }
      run = { ...run, tips: run.tips + tips };
      if (user) clearRewardStart(user.username);
      writeJSON(SAVE_KEY, null);
      if (user) void syncSave(null);
      set(s => ({ run, combat: null, lossBy: null, saved: null, ...pending, user: s.user ? { ...s.user, ...pending } : null }));
      if (tips) get().showToast(`Banked rewards: +${tips} tips for this climb`);
      return true;
    } catch {
      get().showToast('Could not start the climb. Your reward is safe; select New Climb again to retry.');
      return false;
    } finally { rewardStarting = false; set({ startingRun: false }); }
  },
  continueRun: () => {
    const saved = migrateRun(get().saved);
    if (saved) set({ run: saved, combat: null });
  },

  /** Use a checkpoint that came from the cloud as this device's checkpoint. */
  adoptSave: (r) => {
    const saved = migrateRun(r);
    writeJSON(SAVE_KEY, saved);
    set({ saved });
  },

  startFight: () => set((s) => ({ combat: newCombat(s.run.floor) })),

  // Upgrades only between fights, so the checkpoint never holds a mid-fight snapshot.
  // Boss Demo: a throwaway run parked on the boss's floor. Nothing it does is
  // saved, logged or sent to the leaderboard (see winFight / loseRun).
  startBossDemo: (enemyIdx) => {
    const s = get();
    set({
      bossDemo: s.bossDemo ?? { run: s.run, saved: s.saved },
      run: { ...freshRun(s.run.instrument), floor: enemyIdx },
      combat: newCombat(enemyIdx),
      lossBy: null,
    });
    get().go('combat', 'iris');
  },
  endBossDemo: () => {
    const backup = get().bossDemo;
    get().go('title', 'iris');
    // Restore once the iris has covered the fight (screen swaps at 520 ms), so
    // Combat never re-renders against the real run's HP/stats.
    window.setTimeout(() => {
      if (backup) set({ run: backup.run, saved: backup.saved, combat: null, bossDemo: null });
    }, 600);
  },

  buy: (id) => {
    const { run, screen, user } = get();
    if (screen === 'combat') return false;
    const { affordable, cost } = canAfford(run, id);
    if (!affordable) return false;
    const levels = { ...run.levels, [id]: run.levels[id] + 1 };
    const next: Run = { ...run, tips: run.tips - cost, levels };
    if (id === 'maxHp') next.hp = stat(next, 'maxHp');
    if (get().bossDemo) {
      set({ run: next }); // demo purchases are throwaway
      return true;
    }
    set({ run: next, saved: next });
    writeJSON(SAVE_KEY, next);
    if (user) void syncSave(next);
    return true;
  },

  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => set((s) => (s.toast === toast ? { toast: null } : {})), 3200);
  },

  resolveCard: (cardIdx, pass, hits, total, simulated) =>
    set((s) => {
      const c = s.combat!;
      const ev: RunEvent = ['c', fightFloor(s.run), pass ? 1 : 0, hits, total];
      const hand = c.hand.map((card, i) =>
        i === cardIdx ? { ...card, landed: pass || card.landed, fails: card.fails + (pass ? 0 : 1) } : card,
      );
      const failStreak = pass ? 0 : c.failStreak + 1;
      let heat = Math.max(0, Math.min(3, c.heat + (pass ? -1 : 1))) as Combat['heat'];
      if (failStreak >= 2 || (!pass && s.run.hp <= LOW_HP_TAUNT)) heat = 3;
      let encore = c.encore;
      if (encore && hand.every((h) => h.landed)) encore = { ...encore, charged: true };
      return {
        combat: { ...c, hand, failStreak, heat, encore, hits: c.hits + hits, total: c.total + total },
        run: {
          ...s.run,
          score: addScore(s.run.score, ev),
          log: [...s.run.log, ev],
          demo: s.run.demo || simulated,
          stats: {
            ...s.run.stats,
            notesHit: s.run.stats.notesHit + hits,
            notesTotal: s.run.stats.notesTotal + total,
            cardsLanded: s.run.stats.cardsLanded + (pass ? 1 : 0),
            cardsFailed: s.run.stats.cardsFailed + (pass ? 0 : 1),
            rounds: s.run.stats.rounds + 1,
          },
        },
      };
    }),

  // PRD §4: after an Encore (pass or fail) it's uncharged until the whole hand has
  // landed; once the hand is empty it stays charged every round, so a boss that
  // survives an Encore can always be finished.
  resolveEncore: (pass, hits, total, simulated) =>
    set((s) => {
      const c = s.combat!;
      const ev: RunEvent = ['e', fightFloor(s.run), pass ? 1 : 0, hits, total];
      const allLanded = c.hand.every((h) => h.landed);
      const failStreak = pass ? 0 : c.failStreak + 1;
      const heat = (pass ? Math.max(0, c.heat - 1) : Math.min(3, c.heat + 1)) as Combat['heat'];
      return {
        combat: {
          ...c,
          failStreak,
          heat: failStreak >= 2 ? 3 : heat,
          encore: { failedOnce: c.encore!.failedOnce || !pass, charged: allLanded },
          hits: c.hits + hits,
          total: c.total + total,
        },
        run: {
          ...s.run,
          score: addScore(s.run.score, ev),
          log: [...s.run.log, ev],
          demo: s.run.demo || simulated,
          stats: {
            ...s.run.stats,
            notesHit: s.run.stats.notesHit + hits,
            notesTotal: s.run.stats.notesTotal + total,
            encoresLanded: s.run.stats.encoresLanded + (pass ? 1 : 0),
            rounds: s.run.stats.rounds + 1,
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
      const seen = [...c.seen];
      return {
        combat: {
          ...c,
          round: c.round + 1,
          hand: c.hand.map((card) => (card.landed ? card : { ...card, exercise: freshExercise(card.type, tempo, seen) })),
          seen,
        },
      };
    }),

  noteTaunt: (id) => set((s) => ({ combat: s.combat && { ...s.combat, used: [...s.combat.used, id] } })),

  winFight: () => {
    const s = get();
    if (s.bossDemo) return;
    logFight(s, true);
    const floor = fightFloor(s.run);
    const boss = ENEMIES[floor - 1].boss;
    const ev: RunEvent = ['w', floor, s.run.hp];
    const run: Run = {
      ...s.run,
      floor,
      tips: s.run.tips + TIPS_PER_WIN + (boss ? ACT_BONUS_TIPS : 0),
      xp: s.run.xp + XP_PER_WIN,
      score: addScore(s.run.score, ev),
      log: [...s.run.log, ev],
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
    if (s.bossDemo) return;
    logFight(s, false);
    set({ lossBy: s.combat?.enemyIdx ?? 0 });
    finishRun(s.run, 'loss');
  },
}));

/** Anonymous per-fight record for the bestiary danger stats (no-op without a database). Practice fights are skipped. */
function logFight(s: GameState, won: boolean) {
  const c = s.combat;
  if (!c || s.run.demo) return;
  void fetch('/api/fights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enemyId: ENEMIES[c.enemyIdx].id, won, accuracy: c.total ? Math.round((c.hits / c.total) * 100) : 0, rounds: Math.min(50, c.round), instrument: s.run.instrument }),
  }).catch(() => {});
}

interface PendingRun {
  runId: string;
  events: RunEvent[];
  endedBy: 'loss' | 'victory';
  instrument: InstrumentId;
  durationMs: number;
}

/**
 * Posts the queued finished run. It stays queued until the server answers:
 * a 2xx or 4xx (rejected, retrying won't help) clears it; 429 (cooldown),
 * network errors and 5xx keep it for a retry. The server dedupes by runId.
 */
async function flushPending() {
  const p = readJSON<PendingRun>(PENDING_KEY);
  if (!p || !useGame.getState().user) return;
  try {
    const res = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    if (res.status === 429) {
      // Submission cooldown: try once more after the server's Retry-After.
      const wait = Math.min(120, Number(res.headers.get('Retry-After')) || 60);
      window.setTimeout(() => void flushPending(), wait * 1000);
    } else if (res.status < 500) writeJSON(PENDING_KEY, null);
  } catch {
    /* offline: try again later */
  }
}

function finishRun(run: Run, endedBy: 'loss' | 'victory') {
  writeJSON(SAVE_KEY, null);
  const best = readJSON<{ score: number; floor: number }>(BEST_KEY);
  if (!best || run.score > best.score) writeJSON(BEST_KEY, { score: run.score, floor: run.floor });
  useGame.setState({ saved: null, best: readJSON(BEST_KEY) });
  if (!run.demo && run.log.length) {
    writeJSON(PENDING_KEY, { runId: run.id, events: run.log, endedBy, instrument: run.instrument, durationMs: Date.now() - run.startedAt } satisfies PendingRun);
  }
  if (useGame.getState().user) {
    void syncSave(null);
    void flushPending();
  }
}

/** Retry a queued run submission (e.g. after a reload while signed in). */
export const retryPendingRun = () => void flushPending();

export const instrumentOf = (run: Run) => INSTRUMENTS.find((i) => i.id === run.instrument)!;
