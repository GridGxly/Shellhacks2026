import type { ChangeStream } from 'mongodb';
import { db, dbConfigured, offline, type RunDoc } from '@/lib/db';

// Live leaderboard (Server-Sent Events). An Atlas change stream on `runs` pushes
// every newly posted run to open leaderboards, which re-rank and pop the row in.
// Serverless functions can't hold a stream forever: close before maxDuration and
// let EventSource reconnect on its own.
export const maxDuration = 300;
const LIFETIME_MS = 270_000;
const HEARTBEAT_MS = 15_000;

export async function GET(request: Request) {
  if (!dbConfigured()) return offline();
  const runs = (await db()).collection<RunDoc>('runs');
  const enc = new TextEncoder();
  let watch: ChangeStream<RunDoc> | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (text: string) => { if (open) controller.enqueue(enc.encode(text)); };
      const close = () => {
        if (!open) return;
        open = false;
        timers.forEach(clearTimeout);
        void watch?.close().catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      };
      send('retry: 2000\n\n');
      send('event: ready\ndata: {}\n\n');
      watch = runs.watch<RunDoc>([{ $match: { operationType: 'insert' } }]);
      watch.on('change', (ev) => {
        if (ev.operationType !== 'insert') return;
        const r = ev.fullDocument;
        send(`event: run\ndata: ${JSON.stringify({ username: r.username, score: r.score, floor: r.floor, instrument: r.instrument, accuracy: r.accuracy, weekKey: r.weekKey, at: r.at })}\n\n`);
      });
      watch.on('error', close);
      const beat = () => { send(': beat\n\n'); timers.push(setTimeout(beat, HEARTBEAT_MS)); };
      timers.push(setTimeout(beat, HEARTBEAT_MS), setTimeout(close, LIFETIME_MS));
      request.signal.addEventListener('abort', close);
    },
    cancel() {
      timers.forEach(clearTimeout);
      timers = [];
      void watch?.close().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
