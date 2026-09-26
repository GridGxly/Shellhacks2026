import type { ChangeStream } from 'mongodb';
import { db, dbConfigured, offline, type RunDoc } from '@/lib/db';
import { handled } from '@/lib/server/http';

// Live leaderboard (Server-Sent Events). An Atlas change stream on `runs` pushes
// every newly posted run to open leaderboards, which re-rank and pop the row in.
// Serverless functions can't hold a stream forever: close before maxDuration and
// let EventSource reconnect on its own.
export const maxDuration = 300;
const LIFETIME_MS = 270_000;
const HEARTBEAT_MS = 15_000;

// Next dev can replace this module while old responses still own cursors.
const live = globalThis as typeof globalThis & { _stcLiveStreams?: Set<() => Promise<void>> };
live._stcLiveStreams?.forEach((close) => { void close(); });
const active = live._stcLiveStreams = new Set<() => Promise<void>>();

export async function GET(request: Request) {
  return handled(async () => {
    if (!dbConfigured()) return offline();
    const runs = (await db()).collection<RunDoc>('runs');
    const enc = new TextEncoder();
    let watch: ChangeStream<RunDoc> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lifetime: ReturnType<typeof setTimeout> | undefined;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let open = true;
    let closing: Promise<void> | undefined;
    const close = () => {
      if (closing) return closing;
      open = false;
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      request.signal.removeEventListener('abort', close);
      active.delete(close);
      watch?.removeAllListeners('change');
      try { controller?.close(); } catch { /* response already cancelled */ }
      closing = watch?.close().catch(() => {}) ?? Promise.resolve();
      return closing;
    };

    const stream = new ReadableStream<Uint8Array>({
      start(target) {
        controller = target;
        if (request.signal.aborted) { void close(); return; }
        const send = (text: string) => {
          if (!open) return;
          try { controller.enqueue(enc.encode(text)); } catch { void close(); }
        };
        watch = runs.watch<RunDoc>([{ $match: { operationType: 'insert' } }]);
        watch.on('change', (ev) => {
          if (ev.operationType !== 'insert') return;
          const r = ev.fullDocument;
          send(`event: run\ndata: ${JSON.stringify({ username: r.username, score: r.score, floor: r.floor, instrument: r.instrument, accuracy: r.accuracy, weekKey: r.weekKey, at: r.at })}\n\n`);
        });
        watch.on('error', close);
        heartbeat = setInterval(() => send(': beat\n\n'), HEARTBEAT_MS);
        lifetime = setTimeout(close, LIFETIME_MS);
        active.add(close);
        request.signal.addEventListener('abort', close, { once: true });
        send('retry: 2000\n\n');
        send('event: ready\ndata: {}\n\n');
      },
      cancel: close,
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
    });
  });
}
