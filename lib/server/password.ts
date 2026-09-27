import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import bcrypt from 'bcryptjs';

// scrypt runs on libuv's thread pool, so hashing no longer blocks the event
// loop (bcryptjs is pure JS on the main thread). Format:
//   scrypt$<log2 N>$<r>$<p>$<salt b64url>$<key b64url>
// Accounts created before this still hold bcrypt hashes; they verify through
// bcryptjs and are rehashed on their next successful sign-in.
const LOG_N = 15, R = 8, P = 1, KEY_BYTES = 32;
const MAXMEM = 64 * 1024 * 1024; // 128 * N * r = 32 MiB for these parameters

const derive = (password: string, salt: Buffer, logN: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const options: ScryptOptions = { N: 2 ** logN, r, p, maxmem: MAXMEM };
    scrypt(password, salt, KEY_BYTES, options, (err, key) => (err ? reject(err) : resolve(key)));
  });

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, LOG_N, R, P);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

let dummy: Promise<string> | undefined;
/**
 * Checks a password against a stored hash. With no stored hash (unknown user)
 * it still runs a full scrypt, so response time doesn't reveal which accounts exist.
 */
export async function verifyPassword(password: string, stored: string | undefined): Promise<{ ok: boolean; rehash: boolean }> {
  if (stored && !stored.startsWith('scrypt$')) return { ok: await bcrypt.compare(password, stored), rehash: true };
  const target = stored ?? await (dummy ??= hashPassword(randomBytes(16).toString('hex')));
  const [, logN, r, p, salt, key] = target.split('$');
  const expected = Buffer.from(key, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), Number(logN), Number(r), Number(p));
  return { ok: !!stored && actual.length === expected.length && timingSafeEqual(actual, expected), rehash: false };
}
