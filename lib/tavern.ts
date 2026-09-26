'use client';
import { useEffect, useState } from 'react';
import { ac, duetTone, effectsOutput } from './audio';
import { INSTRUMENTS } from './content';
import type { Exercise } from './music';
import { tavernDurationMs, tavernExercise } from './tavern-exercise';
import { TAVERN_POLL_MS, TAVERN_WAITING_POLL_MS } from './config';
import type { PublicTavernPlayer, PublicTavernRoom, TavernEntry, TavernPart } from './tavern-types';

let sessionGuestName = '';
export function tavernGuestName() {
  return sessionGuestName ||= `GUEST ${String(crypto.getRandomValues(new Uint8Array(1))[0] % 100).padStart(2, '0')}`;
}

export type TavernSeat = Pick<TavernEntry, 'code' | 'token' | 'part'>;
export const duetPart = (part: TavernPart): Exercise => tavernExercise('duet', part);
export const duetDurationMs = () => tavernDurationMs('duet');
export class TavernError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Tokens travel in headers/body so local request logs never contain them. */
export async function tavernRequest<T>(path: string, body?: unknown, seat?: TavernSeat, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 4_000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(seat ? { Authorization: `Bearer ${seat.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new TavernError(data.error ?? 'The tavern is unavailable.', response.status);
    return data as T;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export function leaveTavern(seat: TavernSeat) {
  const body = JSON.stringify({ token: seat.token });
  const url = `/api/tavern/${seat.code}/leave`;
  if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

export class TavernClock {
  private samples: number[] = [];
  offset = 0;
  observe(serverNow: number, sent: number, received: number) {
    this.samples.push(serverNow - (sent + received) / 2);
    this.samples = this.samples.slice(-5);
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];
    return this.offset;
  }
}

export function useTavernRoom(seat: TavernSeat | null, disconnected: () => void) {
  const [room, setRoom] = useState<PublicTavernRoom | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!seat) return;
    const clock = new TavernClock();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      const sent = Date.now();
      try {
        const next = await tavernRequest<PublicTavernRoom>(`/api/tavern/${seat.code}`, undefined, seat, controller.signal);
        if (controller.signal.aborted) return;
        setOffset(clock.observe(next.serverNow, sent, Date.now()));
        if (next.phase === 'gone' || next.partnerStale) { disconnected(); return; }
        failures = 0;
        setRoom(next);
        timer = setTimeout(poll, next.phase === 'waiting' ? TAVERN_WAITING_POLL_MS : TAVERN_POLL_MS);
      } catch (error) {
        if (controller.signal.aborted) return;
        failures++;
        if ((error instanceof TavernError && [403, 404].includes(error.status)) || failures >= 3) { disconnected(); return; }
        timer = setTimeout(poll, TAVERN_POLL_MS);
      }
    };
    const unload = () => leaveTavern(seat);
    window.addEventListener('pagehide', unload);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('pagehide', unload); leaveTavern(seat); };
  }, [seat, disconnected]);
  return { room, offset };
}

export interface TavernClip { audio?: string; mime?: string; offsetMs: number }
export class TavernRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private finished: Promise<TavernClip> | null = null;
  private offsetMs = 0;
  start(stream: MediaStream | null, downbeatPerf: number) {
    if (!stream || typeof MediaRecorder === 'undefined') return;
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) return;
    try {
      const recorder = this.recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
      this.finished = new Promise((resolve) => {
        recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
        recorder.onerror = () => resolve({ offsetMs: this.offsetMs });
        recorder.onstop = async () => {
          try {
            const blob = new Blob(this.chunks, { type: recorder.mimeType });
            if (!blob.size || blob.size > 400 * 1024) return resolve({ offsetMs: this.offsetMs });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            resolve({ audio: btoa(binary), mime: recorder.mimeType, offsetMs: this.offsetMs });
          } catch { resolve({ offsetMs: this.offsetMs }); }
          finally { this.chunks = []; }
        };
      });
      recorder.start();
      this.offsetMs = performance.now() - downbeatPerf;
    } catch { this.recorder = null; this.finished = null; }
  }
  async stop(): Promise<TavernClip> {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    if (!this.finished) return { offsetMs: 0 };
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([this.finished, new Promise<TavernClip>((resolve) => {
        timer = setTimeout(() => resolve({ offsetMs: this.offsetMs }), 3000);
      })]);
    } finally { clearTimeout(timer!); }
  }
  cancel() {
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.chunks = [];
    this.recorder = null;
  }
}

/** Decode the two ephemeral takes; use precisely the hit notes for a missing take. */
export async function playDuet(room: PublicTavernRoom, seat: TavernSeat, offset: number, signal: AbortSignal, activity: (levels: [number, number]) => void) {
  const mine = seat.part === 'A' ? room.host : room.guest!;
  const partner = seat.part === 'A' ? room.guest! : room.host;
  const players = [mine, partner];
  const ctx = ac();
  const clips = await Promise.all(players.map(async (player, index) => {
    if (!player.result?.hasAudio) return null;
    const clipController = new AbortController();
    const abort = () => clipController.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timeout = setTimeout(abort, 4000);
    try {
      const response = await fetch(`/api/tavern/${seat.code}/audio?who=${index ? 'partner' : 'self'}`, { headers: { Authorization: `Bearer ${seat.token}` }, signal: clipController.signal, cache: 'no-store' });
      if (!response.ok) return null;
      return await ctx.decodeAudioData(await response.arrayBuffer());
    } catch { return null; }
    finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  }));
  if (signal.aborted) return;
  const localStart = (room.playbackAt ?? room.serverNow) - offset;
  const base = ctx.currentTime + (localStart - Date.now()) / 1000;
  const nodes: (AudioBufferSourceNode | OscillatorNode)[] = [];
  const analysers = players.map(() => { const a = ctx.createAnalyser(); a.fftSize = 256; a.connect(effectsOutput()); return a; });
  const fallback = (player: PublicTavernPlayer, out: AudioNode) => {
    const ex = tavernExercise(room.mode, player.part);
    const shift = INSTRUMENTS.find((instrument) => instrument.id === player.instrument)!.shift;
    const hitIndices = new Set(player.result?.hitIndices ?? ex.notes.slice(0, player.result?.hits ?? 0).map((_, index) => index));
    ex.notes.forEach((note, index) => {
      if (!hitIndices.has(index)) return;
      const start = base + note.startBeat * 60 / ex.tempo;
      const end = start + note.durBeats * 60 / ex.tempo * 0.92;
      const at = Math.max(ctx.currentTime + 0.015, start);
      if (end > at + 0.02) nodes.push(duetTone(note.midi + shift, at, end - at, out));
    });
  };
  players.forEach((player, index) => {
    const buffer = clips[index];
    if (!buffer) { fallback(player, analysers[index]); return; }
    const clipOffset = (player.result?.offsetMs ?? 0) / 1000;
    const planned = base + Math.max(0, clipOffset);
    const when = Math.max(ctx.currentTime + 0.015, planned);
    const trim = Math.max(0, -clipOffset) + (when - planned);
    if (trim >= buffer.duration) return;
    const source = ctx.createBufferSource(); source.buffer = buffer;
    source.connect(analysers[index]); source.start(when, trim); nodes.push(source);
  });
  const arrays = analysers.map(() => new Float32Array(256));
  let frame = 0;
  let last = 0;
  const sample = (now: number) => {
    if (signal.aborted) return;
    if (now - last > 80) {
      last = now;
      activity(analysers.map((analyser, index) => {
        analyser.getFloatTimeDomainData(arrays[index]);
        return Math.sqrt(arrays[index].reduce((sum, v) => sum + v * v, 0) / arrays[index].length);
      }) as [number, number]);
    }
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);
  await new Promise<void>((resolve) => {
    const clean = () => {
      clearTimeout(timer); cancelAnimationFrame(frame); signal.removeEventListener('abort', clean);
      nodes.forEach((node) => { try { node.stop(); } catch { /* already ended */ } node.disconnect(); });
      analysers.forEach((analyser) => analyser.disconnect());
      activity([0, 0]); resolve();
    };
    const timer = setTimeout(clean, Math.max(0, localStart + tavernDurationMs(room.mode) + 600 - Date.now()));
    signal.addEventListener('abort', clean, { once: true });
    if (signal.aborted) clean();
  });
}
