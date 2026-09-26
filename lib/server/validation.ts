import { INSTRUMENTS, FINAL_FLOOR, type InstrumentId } from '@/lib/content';
import { STATS } from '@/lib/config';
import { verifyRun, type RunEvent } from '@/lib/score';
import { int, object } from './http';

export const instrument = (v: unknown): v is InstrumentId => INSTRUMENTS.some((i) => i.id === v);
export const runId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(v);
export const credentials = (u: unknown, p: unknown, minLength = 8): u is string => typeof u === 'string' && /^[a-zA-Z0-9_]{3,16}$/.test(u) && typeof p === 'string' && p.length >= minLength && Buffer.byteLength(p) <= 72;

export function saveRun(v: unknown) {
  if (!object(v) || !runId(v.id) || !instrument(v.instrument) || !int(v.hp, 0, STATS.find((s) => s.id === 'maxHp')!.max) || !int(v.tips) || !int(v.xp) || !int(v.floor, 0, FINAL_FLOOR - 1) || !int(v.score) || typeof v.startedAt !== 'number' || !Number.isFinite(v.startedAt) || v.startedAt < 0 || v.startedAt > Date.now() + 86400_000 /* client clocks drift */ || (v.demo !== undefined && typeof v.demo !== 'boolean') || !object(v.levels) || !object(v.stats) || !Array.isArray(v.log)) return null;
  const levels: Record<string, number> = {}, stats: Record<string, number> = {};
  for (const s of STATS) {
    const n = v.levels[s.id];
    if (!int(n, 0, 10)) return null;
    levels[s.id] = n;
  }
  for (const k of ['notesHit', 'notesTotal', 'cardsLanded', 'cardsFailed', 'rounds', 'encoresLanded']) {
    if (!int(v.stats[k])) return null;
    stats[k] = v.stats[k];
  }
  if (stats.notesHit > stats.notesTotal || stats.cardsLanded + stats.cardsFailed + stats.encoresLanded > stats.rounds) return null;
  if (v.log.length) {
    const checked = verifyRun(v.log, 'loss');
    if (typeof checked === 'string' || checked.floor !== v.floor || checked.score !== v.score || checked.xp !== v.xp || Object.keys(stats).some((k) => stats[k] !== checked[k as keyof typeof checked])) return null;
  } else if (v.floor !== 0 || v.score !== 0 || v.xp !== 0 || Object.values(stats).some(Boolean)) return null;
  return { id: v.id, instrument: v.instrument, hp: v.hp, tips: v.tips, xp: v.xp, levels, floor: v.floor, score: v.score, stats, startedAt: v.startedAt, ...(v.demo === undefined ? {} : { demo: v.demo }), log: v.log as RunEvent[] };
}
