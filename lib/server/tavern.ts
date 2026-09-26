import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { ClientSession, Db } from 'mongodb';
import {
  RECORD_TAIL_MS, TAVERN_AUDIO_MAX_BYTES, TAVERN_DONE_TTL_MS, TAVERN_MAX_RECORD_OFFSET_MS,
  TAVERN_PASS, TAVERN_PLAYBACK_DELAY_MS, TAVERN_RESULT_MAX_BYTES, TAVERN_ROOM_TTL_MS,
  TAVERN_STALE_MS, TAVERN_START_DELAY_MS,
} from '@/lib/config';
import { currentUser, db, dbConfigured, offline, transaction, type UserDoc } from '@/lib/db';
import { DUET_A, DUET_B } from '@/lib/music';
import type { PublicTavernPlayer, PublicTavernRoom, TavernPart, TavernPhase, TavernResultInput } from '@/lib/tavern-types';
import { duplicate, handled, int, mutation, readJson } from './http';
import { clientIp, limit } from './ratelimit';
import { instrument } from './validation';

interface Player extends Omit<PublicTavernPlayer, 'result'> {
  tokenHash: string;
  userId: string | null;
  seenAt: Date;
  leftAt?: Date;
  doneAt?: Date;
  result?: TavernResultInput;
}
interface TavernRoomDoc {
  _id: string;
  phase: TavernPhase;
  host: Player;
  guest: Player | null;
  startAt?: Date;
  playbackAt?: Date;
  pass?: boolean;
  createdAt: Date;
  expiresAt: Date;
}
type Side = 'host' | 'guest';
type Action = 'host' | 'join' | 'poll' | 'start' | 'result' | 'audio' | 'leave' | 'done';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const rooms = (d: Db) => d.collection<TavernRoomDoc>('tavernRooms');
const expiry = (now: number) => new Date(now + TAVERN_ROOM_TTL_MS);
const finished = (room: TavernRoomDoc) => room.phase === 'results' || room.phase === 'done';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const error = (message: string, status = 400) => json({ error: message, serverNow: Date.now() }, status);
const own = (room: TavernRoomDoc, tokenHash: string): Side | null => room.host.tokenHash === tokenHash ? 'host' : room.guest?.tokenHash === tokenHash ? 'guest' : null;
const partner = (room: TavernRoomDoc, side: Side) => side === 'host' ? room.guest : room.host;

function publicPlayer(player: Player): PublicTavernPlayer {
  const { name, instrument, part, result } = player;
  return { name, instrument, part, ...(result ? { result: {
    hits: result.hits, total: result.total, offsetMs: result.offsetMs,
    hasAudio: !!result.audio, ...(result.mime ? { mime: result.mime } : {}),
    ...(result.hitIndices ? { hitIndices: result.hitIndices } : {}),
  } } : {}) };
}
function snapshot(room: TavernRoomDoc, side: Side, now = Date.now()): PublicTavernRoom {
  const other = partner(room, side);
  return {
    code: room._id, phase: room.phase, host: publicPlayer(room.host), guest: room.guest ? publicPlayer(room.guest) : null,
    ...(room.startAt ? { startAt: room.startAt.getTime() } : {}),
    ...(room.playbackAt ? { playbackAt: room.playbackAt.getTime() } : {}),
    ...(room.pass === undefined ? {} : { pass: room.pass }), serverNow: now,
    // A normal continue after results must not disconnect the partner's verdict.
    partnerStale: !finished(room) && !!other && (Boolean(other.leftAt) || now - other.seenAt.getTime() > TAVERN_STALE_MS),
  };
}
function memberToken(request: Request, body: Record<string, unknown>) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : body.token ?? new URL(request.url).searchParams.get('token');
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(token) ? hash(token) : null;
}
async function load(d: Db, code: string, session?: ClientSession) {
  return rooms(d).findOne({ _id: code, expiresAt: { $gt: new Date() } }, { session });
}
function resultInput(body: Record<string, unknown>, part: TavernPart): TavernResultInput | null {
  const ex = part === 'A' ? DUET_A : DUET_B;
  if (body.total !== ex.notes.length || !int(body.hits, 0, ex.notes.length) || typeof body.offsetMs !== 'number' || !Number.isFinite(body.offsetMs) || Math.abs(body.offsetMs) > TAVERN_MAX_RECORD_OFFSET_MS) return null;
  let hitIndices: number[] | undefined;
  if (body.hitIndices !== undefined) {
    if (!Array.isArray(body.hitIndices) || body.hitIndices.length !== body.hits || body.hitIndices.some(i => !int(i, 0, ex.notes.length - 1)) || new Set(body.hitIndices).size !== body.hitIndices.length) return null;
    hitIndices = [...body.hitIndices].sort((a, b) => a - b);
  }
  let audio: string | undefined, mime: string | undefined;
  if (body.audio !== undefined) {
    if (typeof body.audio !== 'string' || !body.audio.length || body.audio.length > Math.ceil(TAVERN_AUDIO_MAX_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.audio)) return null;
    const bytes = Buffer.from(body.audio, 'base64');
    if (!bytes.length || bytes.length > TAVERN_AUDIO_MAX_BYTES || bytes.toString('base64') !== body.audio) return null;
    if (typeof body.mime !== 'string') return null;
    mime = body.mime.toLowerCase().replaceAll(' ', '');
    if (!['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2'].includes(mime)) return null;
    audio = body.audio;
  } else if (body.mime !== undefined) return null;
  return { hits: body.hits, total: ex.notes.length, offsetMs: Math.round(body.offsetMs), ...(audio ? { audio, mime } : {}), ...(hitIndices ? { hitIndices } : {}) };
}

/** Shared route boundary: tokens stay out of public snapshots and normal URLs. */
export async function tavernRequest(request: Request, action: Action, rawCode?: string) {
  return handled(async () => {
    const mutating = request.method !== 'GET';
    if (mutating) { const guard = mutation(request, action !== 'leave'); if (guard) return guard; }
    const body = mutating ? await readJson(request, action === 'result' ? TAVERN_RESULT_MAX_BYTES : 2048) : {};
    if (body instanceof Response) return body;
    if (!dbConfigured()) return offline();
    if (action === 'host' || action === 'join') {
      if (!instrument(body.instrument)) return error('Choose an instrument.');
      const blocked = await limit(`tavern-${action}:${clientIp(request)}`, action === 'host' ? 12 : 30, 600_000);
      if (blocked) return blocked;
      const user = await currentUser();
      const token = randomBytes(24).toString('base64url');
      const now = Date.now();
      const name = user?.username ?? (typeof body.name === 'string' && /^GUEST \d{2}$/.test(body.name) ? body.name : `GUEST ${String(randomInt(100)).padStart(2, '0')}`);
      const player: Player = { name, instrument: body.instrument, part: action === 'host' ? 'A' : 'B', tokenHash: hash(token), userId: user?._id ?? null, seenAt: new Date(now) };
      if (action === 'host') {
        const d = await db();
        for (let attempt = 0; attempt < 12; attempt++) {
          const code = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
          try {
            await rooms(d).insertOne({ _id: code, phase: 'waiting', host: player, guest: null, createdAt: new Date(now), expiresAt: expiry(now) });
            return json({ code, token, part: 'A', serverNow: now });
          } catch (e) { if (!duplicate(e)) throw e; }
        }
        return error('The tavern is busy. Try hosting again.', 503);
      }
      const code = rawCode?.toUpperCase() ?? '';
      if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) return error('No show with that code.', 404);
      return transaction(async (d, session) => {
        const room = await load(d, code, session);
        if (!room || room.phase === 'gone') return error('No show with that code.', 404);
        if (room.guest || room.phase !== 'waiting') return error('That show is full or has started.', 409);
        if (now - room.host.seenAt.getTime() > TAVERN_STALE_MS) return error('That host has left the tavern.', 410);
        if (player.userId && player.userId === room.host.userId) return error('A duet needs two different players.', 409);
        room.guest = player; room.phase = 'ready'; room.expiresAt = expiry(now);
        await rooms(d).replaceOne({ _id: code }, room, { session });
        return json({ code, token, part: 'B', serverNow: Date.now() });
      });
    }

    const code = rawCode?.toUpperCase() ?? '';
    if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) return error('No show with that code.', 404);
    const tokenHash = memberToken(request, body);
    if (!tokenHash) return error('This show needs your player token.', 403);

    // Audio reads never return the other player's token, identity or base64 clip in polls.
    if (action === 'audio') {
      const room = await load(await db(), code);
      if (!room || room.phase === 'gone') return error('No show with that code.', 404);
      const side = own(room, tokenHash); if (!side) return error('You are not in this show.', 403);
      const who = new URL(request.url).searchParams.get('who') ?? 'partner';
      if (who !== 'self' && who !== 'partner') return error('Choose self or partner audio.');
      if (!finished(room)) return error('The duet is not ready yet.', 409);
      const take = (who === 'self' ? room[side] : partner(room, side))?.result;
      if (!take?.audio || !take.mime) return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
      return new Response(new Uint8Array(Buffer.from(take.audio, 'base64')), { headers: { 'Content-Type': take.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }

    return transaction(async (d, session) => {
      const room = await load(d, code, session);
      if (!room) return error('No show with that code.', 404);
      const side = own(room, tokenHash); if (!side) return error('You are not in this show.', 403);
      const player = room[side]!;
      const now = Date.now();
      if (room.phase === 'gone' && action !== 'leave') return json(snapshot(room, side, now));
      if (player.leftAt && action !== 'leave') return error('You have left this show.', 410);
      const other = partner(room, side);

      if (action === 'start') {
        if (side !== 'host') return error('Only the host can start the show.', 403);
        if (room.phase === 'countdown') return json(snapshot(room, side, now));
        if (room.phase !== 'ready' || !other) return error('Wait for the second musician.', 409);
        if (now - other.seenAt.getTime() > TAVERN_STALE_MS) return error('The other musician disconnected.', 410);
        room.startAt = new Date(now + TAVERN_START_DELAY_MS); room.phase = 'countdown';
      } else if (action === 'result') {
        const take = resultInput(body, player.part);
        if (!take) return error('That take has invalid notes, timing or audio.');
        if (player.result) {
          if (JSON.stringify(player.result) !== JSON.stringify(take)) return error('Your take was already submitted.', 409);
          return json(snapshot(room, side, now));
        }
        if (room.phase !== 'countdown' || !room.startAt || !room.guest) return error('The show has not started.', 409);
        const ex = player.part === 'A' ? DUET_A : DUET_B;
        const end = Math.max(...ex.notes.map(note => note.startBeat + note.durBeats)) * 60000 / ex.tempo;
        if (now < room.startAt.getTime() + end + RECORD_TAIL_MS - 300) return error('Finish playing before sending your take.', 409);
        if (other && now - other.seenAt.getTime() > TAVERN_STALE_MS) return error('The other musician disconnected.', 410);
        player.result = take;
        if (room.host.result && room.guest.result) {
          const a = room.host.result, b = room.guest.result;
          room.pass = (a.hits + b.hits) / (a.total + b.total) >= TAVERN_PASS;
          room.phase = 'results'; room.playbackAt = new Date(now + TAVERN_PLAYBACK_DELAY_MS);
          // The room transition and grants commit together. Immutable result retries
          // return above, so claiming a buff then retrying cannot grant it again.
          if (room.pass) {
            const ids = [room.host.userId, room.guest.userId].filter((id): id is string => id !== null);
            if (ids.length) await d.collection<UserDoc>('users').updateMany({ _id: { $in: ids } }, { $set: { tavernBuff: true } }, { session });
          }
        }
      } else if (action === 'done') {
        if (!finished(room)) return error('The duet is not ready yet.', 409);
        if (room.phase === 'done') return json(snapshot(room, side, now));
        player.doneAt ??= new Date(now);
        if (room.host.doneAt && room.guest?.doneAt) { room.phase = 'done'; room.expiresAt = new Date(now + TAVERN_DONE_TTL_MS); }
      } else if (action === 'leave') {
        player.leftAt ??= new Date(now);
        if (!room.guest || (room.host.leftAt && room.guest.leftAt)) {
          await rooms(d).deleteOne({ _id: code }, { session });
          return json({ ...snapshot(room, side, now), phase: 'gone' });
        }
        if (!finished(room)) room.phase = 'gone';
      }

      player.seenAt = new Date(now);
      // Once done/gone, polling cannot keep audio alive indefinitely.
      if (room.phase === 'gone') room.expiresAt = new Date(now + TAVERN_DONE_TTL_MS);
      else if (room.phase !== 'done') room.expiresAt = expiry(now);
      await rooms(d).replaceOne({ _id: code }, room, { session });
      return json(snapshot(room, side, now));
    });
  });
}
