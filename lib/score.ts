// Run scoring (PRD §7b), shared by the client and /api/runs so both compute the
// same number. The client records one compact event per action; the server
// replays the log, checks it is plausible, and recomputes the score from it.

import {
  ACT_BONUS_SCORE, HAND_SIZE, MAX_ACTIONS_PER_FIGHT, MAX_NOTES_PER_EXERCISE, SCORE_CARD_BASE,
  SCORE_CARD_FAIL, SCORE_CARD_PER_ACC, SCORE_ENCORE, SCORE_PER_FLOOR, SCORE_PER_HP, STATS,
  ULTIMATE_PASS_THRESHOLD, XP_PER_WIN,
} from './config';
import { ENEMIES, FINAL_FLOOR } from './content';

/** floor = the fight's floor number (1..18). pass is 0/1. */
export type RunEvent =
  | ['c', floor: number, pass: 0 | 1, hits: number, total: number] // card
  | ['e', floor: number, pass: 0 | 1, hits: number, total: number] // encore
  | ['w', floor: number, hpLeft: number]; // enemy beaten, HP before the heal

export function eventScore(ev: RunEvent): number {
  if (ev[0] === 'w') {
    const [, floor, hp] = ev;
    return SCORE_PER_FLOOR * floor + SCORE_PER_HP * hp + (ENEMIES[floor - 1]?.boss ? ACT_BONUS_SCORE : 0);
  }
  const [kind, , pass, hits, total] = ev;
  if (kind === 'e') return pass ? SCORE_ENCORE : 0;
  if (!pass) return SCORE_CARD_FAIL;
  const acc = total ? (hits / total) * 100 : 0;
  return Math.round(SCORE_CARD_BASE + acc * SCORE_CARD_PER_ACC);
}

/** Running total never drops below 0. */
export const addScore = (score: number, ev: RunEvent) => Math.max(0, score + eventScore(ev));

export interface VerifiedRun {
  floor: number; // enemies beaten
  victory: boolean;
  score: number;
  xp: number;
  accuracy: number; // 0..100
  notesHit: number;
  notesTotal: number;
  cardsLanded: number;
  cardsFailed: number;
  encoresLanded: number;
  rounds: number;
}

const statMax = (id: string) => {
  const d = STATS.find((s) => s.id === id)!;
  return d.max;
};
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/**
 * Replays a submitted log. Returns the verified run, or an error string when the
 * log is malformed or impossible (hackathon-level anti-cheat: it can't prove the
 * notes were really played, only that the numbers are consistent with the rules).
 */
export function verifyRun(events: unknown, endedBy: unknown): VerifiedRun | string {
  if (endedBy !== 'loss' && endedBy !== 'victory') return 'Bad endedBy.';
  if (!Array.isArray(events) || events.length === 0) return 'Empty run.';
  if (events.length > FINAL_FLOOR * (MAX_ACTIONS_PER_FIGHT + 1)) return 'Run too long.';

  const minCardLine = statMax('passLine') / 100; // lowest pass line the upgrade can reach
  const maxCardLine = STATS.find((s) => s.id === 'passLine')!.base / 100;
  const maxCardDmg = statMax('cardDamage');
  const maxEncoreDmg = statMax('encoreDamage');
  const maxHp = statMax('maxHp');

  const r: VerifiedRun = { floor: 0, victory: false, score: 0, xp: 0, accuracy: 0, notesHit: 0, notesTotal: 0, cardsLanded: 0, cardsFailed: 0, encoresLanded: 0, rounds: 0 };
  let fight = { actions: 0, cards: 0, encores: 0 };

  for (const raw of events) {
    if (!Array.isArray(raw)) return 'Bad event.';
    const ev = raw as RunEvent;
    const current = r.floor + 1; // the fight in progress
    if (current > FINAL_FLOOR) return 'Events after the final floor.';
    if (ev[1] !== current) return 'Floors out of order.';
    const enemy = ENEMIES[current - 1];

    if (ev[0] === 'w') {
      if (ev.length !== 3 || !isInt(ev[2], 1, maxHp)) return 'Bad win.';
      const dmg = fight.cards * maxCardDmg + fight.encores * maxEncoreDmg;
      if (dmg < enemy.hp) return 'Win without enough damage.';
      r.floor = current;
      r.xp += XP_PER_WIN;
      fight = { actions: 0, cards: 0, encores: 0 };
    } else if (ev[0] === 'c' || ev[0] === 'e') {
      const [kind, , pass, hits, total] = ev;
      if (ev.length !== 5 || (pass !== 0 && pass !== 1) || !isInt(total, 1, MAX_NOTES_PER_EXERCISE) || !isInt(hits, 0, total)) return 'Bad action.';
      if (++fight.actions > MAX_ACTIONS_PER_FIGHT) return 'Too many actions in one fight.';
      const ratio = hits / total;
      if (kind === 'c') {
        if (pass ? ratio < minCardLine : ratio >= maxCardLine) return 'Card result does not match its notes.';
        if (pass && ++fight.cards > HAND_SIZE) return 'More cards landed than the hand holds.';
        if (pass) r.cardsLanded++;
        else r.cardsFailed++;
      } else {
        if (!enemy.boss) return 'Encore outside a boss fight.';
        if (pass ? ratio < ULTIMATE_PASS_THRESHOLD : ratio >= ULTIMATE_PASS_THRESHOLD) return 'Encore result does not match its notes.';
        if (pass) {
          fight.encores++;
          r.encoresLanded++;
        }
      }
      r.rounds++;
      r.notesHit += hits;
      r.notesTotal += total;
    } else return 'Bad event.';

    r.score = addScore(r.score, ev);
  }

  r.victory = r.floor === FINAL_FLOOR;
  if ((endedBy === 'victory') !== r.victory) return 'endedBy does not match the log.';
  r.accuracy = r.notesTotal ? Math.round((r.notesHit / r.notesTotal) * 100) : 0;
  return r;
}
