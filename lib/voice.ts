'use client';
import { TAUNT_TIMEOUT_MS } from './config';
import type { Enemy } from './content';
import { noteName, writtenKey, type Exercise } from './music';
import type { NoteResult } from './mic';
import type { TauntFacts, TauntMoment } from './taunts';
import { playVoice, settings } from './audio';

export interface Taunt {
  id: string;
  text: string;
  audio: string | null;
}

export function buildFacts(
  ex: Exercise,
  results: NoteResult[],
  shift: number,
  writtenOffset: number,
  hp: number,
  failCount: number,
): TauntFacts {
  const key = writtenKey(writtenOffset);
  const wrong = results.find((r) => r.status === 'wrong' && r.playedMidi !== null);
  const expectedWritten = wrong ? ex.notes[wrong.index].midi + shift + writtenOffset : undefined;
  const hits = results.filter((r) => r.status === 'hit').length;
  const offs = results.map((r) => r.onsetOffsetMs).filter((v): v is number => v !== null);
  const avg = offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0;
  const bar = wrong ? Math.floor(ex.notes[wrong.index].startBeat / ex.beatsPerBar) + 1 : 1;
  return {
    wrongNote: wrong ? noteName(wrong.playedMidi! + writtenOffset, key) : undefined,
    expectedNote: expectedWritten !== undefined ? noteName(expectedWritten, key) : undefined,
    wrongCount: results.filter((r) => r.status === 'wrong').length,
    missCount: results.length - hits,
    silentCount: results.filter((r) => r.status === 'silent').length,
    totalNotes: results.length,
    accuracy: Math.round((hits / Math.max(1, results.length)) * 100),
    hp,
    failCount,
    timing: avg > 60 ? 'dragged' : avg < -60 ? 'rushed' : undefined,
    cardType: ex.type === 'encore' ? 'Encore' : ex.type,
    bar,
  };
}

/** Asks the server for a line. Resolves with text (and audio when ready in time). */
export async function fetchTaunt(
  enemy: Enemy,
  heat: number,
  moment: TauntMoment,
  facts: TauntFacts,
  used: string[],
): Promise<Taunt | null> {
  if (settings.trashTalk === 'off') return null;
  const h = settings.trashTalk === 'mild' ? Math.min(heat, 1) : heat;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TAUNT_TIMEOUT_MS * 3);
  try {
    const res = await fetch('/api/taunt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enemy: enemy.voice, heat: h, moment, facts, used: used.slice(-50) }),
      signal: ctrl.signal,
    });
    if (res.status === 204) return null;
    const text = decodeURIComponent(res.headers.get('X-Taunt-Text') ?? '');
    const id = res.headers.get('X-Taunt-Id') ?? '';
    let audio: string | null = null;
    if (res.headers.get('Content-Type')?.includes('audio')) {
      const blob = await res.blob();
      audio = URL.createObjectURL(blob);
    }
    return text ? { id, text, audio } : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function speak(t: Taunt, enemy: Enemy): Promise<void> {
  if (!t.audio) return new Promise((r) => window.setTimeout(r, 2200));
  return playVoice(t.audio, enemy.voice === 'choir');
}
