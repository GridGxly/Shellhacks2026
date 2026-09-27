import { guarded } from '@/lib/server/api-guard';
import type { ChangeStream, Collection } from 'mongodb';
import { db, dbConfigured, offline, type RunDoc } from '@/lib/db';

export const maxDuration = 300;
const LIFETIME_MS = 270_000;
const HEARTBEAT_MS = 15_000;
const MAX_SUBSCRIBERS = 128;
type Subscriber = { send: (event: string) => void; close: () => void };

// One cursor per warm server instance, shared by every open leaderboard.
// Closing the last viewer releases the cursor and its database connection.
const live = globalThis as typeof globalThis & { _stcLiveDispose?: () => void };
live._stcLiveDispose?.();
const subscribers = new Set<Subscriber>();
let watch: ChangeStream<RunDoc> | null = null;
const stopWatch = () => {
  const previous = watch; watch = null;
  previous?.removeAllListeners();
  void previous?.close().catch(() => {});
};
live._stcLiveDispose = () => { for (const sub of subscribers) sub.close(); stopWatch(); };
function startWatch(runs: Collection<RunDoc>) {
  if (watch) return;
  const current = watch = runs.watch<RunDoc>([{ $match: { operationType: 'insert' } }], { maxAwaitTimeMS: 10_000 });
  current.on('change', (ev) => {
    if (ev.operationType !== 'insert') return;
    // Clients only need an invalidation signal, not another copy of each run.
    const event = `event: run\ndata: ${JSON.stringify({ weekKey: ev.fullDocument.weekKey })}\n\n`;
    for (const sub of subscribers) sub.send(event);
  });
  current.on('error', () => {
    if (watch !== current) return;
    for (const sub of subscribers) sub.close();
    stopWatch();
  });
}

export async function GET(request: Request) {
  return guarded(request, async () => {
    if (!dbConfigured()) return offline();
    const runs = (await db()).collection<RunDoc>('runs');
    if (subscribers.size >= MAX_SUBSCRIBERS) return new Response(null, { status: 503, headers: { 'Retry-After': '15' } });
    const enc = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lifetime: ReturnType<typeof setTimeout> | undefined;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let open = true;
    const close = () => {
      if (!open) return;
      open = false; clearInterval(heartbeat); clearTimeout(lifetime);
      request.signal.removeEventListener('abort', close);
      subscribers.delete(subscriber);
      if (!subscribers.size) stopWatch();
      try { controller?.close(); } catch { /* response already cancelled */ }
    };
    const subscriber: Subscriber = {
      close,
      send(event) {
        if (!open) return;
        // A suspended/slow client must not retain an unbounded event queue.
        if ((controller.desiredSize ?? 0) <= 0) { close(); return; }
        try { controller.enqueue(enc.encode(event)); } catch { close(); }
      },
    };
    const stream = new ReadableStream<Uint8Array>({
      start(target) {
        controller = target;
        if (request.signal.aborted) { close(); return; }
        subscribers.add(subscriber);
        request.signal.addEventListener('abort', close, { once: true });
        try { startWatch(runs); } catch { close(); return; }
        heartbeat = setInterval(() => subscriber.send(': beat\n\n'), HEARTBEAT_MS);
        lifetime = setTimeout(close, LIFETIME_MS);
        subscriber.send('retry: 5000\nevent: ready\ndata: {}\n\n');
      },
      cancel: close,
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
    });
  });
}
