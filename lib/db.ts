import { randomBytes } from 'node:crypto';
import { MongoClient, type Db, type ClientSession } from 'mongodb';
import { cookies } from 'next/headers';
import { SESSION_DAYS, XP_PER_LEVEL } from './config';
import { sha256Hex } from './server/hash';
import { ensureSchema } from './server/schema';

// PRD §7b: users, sessions, saves, runs. Everything degrades to 503 when
// MONGODB_URI is unset so the game still runs as guest-only.

const SESSION_COOKIE = 'stc_session';

export interface UserDoc {
  _id: string; // lowercased username
  username: string;
  passwordHash: string;
  createdAt: Date;
  xp: number;
  tavernBuff?: boolean;
  trainingBuff?: boolean;
}
export interface SessionDoc {
  _id: string; // sha256(token)
  userId: string;
  expiresAt: Date;
}
export interface RunDoc {
  userId: string;
  username: string;
  score: number;
  floor: number;
  instrument: string;
  accuracy: number;
  notesHit: number;
  notesTotal: number;
  runId: string;
  cardsLanded: number;
  cardsFailed: number;
  encoresLanded: number;
  rounds: number;
  victory: boolean;
  durationMs?: number;
  weekKey: string;
  endedBy: 'loss' | 'victory';
  at: Date;
}

const g = globalThis as unknown as { _stcMongo?: Promise<Db>; _stcClient?: MongoClient };

export function dbConfigured() {
  return !!process.env.MONGODB_URI;
}

export function db(): Promise<Db> {
  if (!g._stcMongo) {
    const client = new MongoClient(process.env.MONGODB_URI!, { maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 60_000, serverSelectionTimeoutMS: 5000, waitQueueTimeoutMS: 3000 });
    g._stcClient = client;
    g._stcMongo = client.connect().then(async (c) => {
      const d = c.db(process.env.MONGODB_DB ?? 'slay-the-choir');
      // One index manifest shared with scripts/atlas-setup.mjs; skipped when already applied.
      await ensureSchema(d);
      return d;
    });
    const pending = g._stcMongo;
    void pending.catch(async () => {
      if (g._stcMongo === pending) g._stcMongo = undefined;
      await client.close().catch(() => {});
    });
  }
  return g._stcMongo;
}

export const offline = () => Response.json({ error: 'Accounts are offline (no database configured).' }, { status: 503 });
export const unauthorized = () => Response.json({ error: 'Sign in first.' }, { status: 401 });

const hash = sha256Hex;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const d = await db();
  await d.collection<SessionDoc>('sessions').insertOne({ _id: hash(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  try {
    if (token && dbConfigured()) await (await db()).collection<SessionDoc>('sessions').deleteOne({ _id: hash(token) });
  } finally {
    jar.delete(SESSION_COOKIE);
  }
}

export async function currentUser(): Promise<UserDoc | null> {
  if (!dbConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Session and account in one round trip (both are _id lookups).
  const [user] = await (await db()).collection<SessionDoc>('sessions').aggregate<UserDoc>([
    { $match: { _id: hash(token), expiresAt: { $gt: new Date() } } },
    { $limit: 1 },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $replaceRoot: { newRoot: '$user' } },
  ]).toArray();
  return user ?? null;
}

export const publicUser = (u: UserDoc) => ({ username: u.username, level: 1 + Math.floor(u.xp / XP_PER_LEVEL), tavernBuff: u.tavernBuff === true, trainingBuff: u.trainingBuff === true });

export async function transaction<T>(work: (d: Db, session: ClientSession) => Promise<T>) {
  const d = await db();
  const session = g._stcClient!.startSession();
  try { return await session.withTransaction(() => work(d, session)); }
  finally { await session.endSession(); }
}
