/**
 * Password hashing with PBKDF2-SHA256 (Web Crypto, available in Workers and Node).
 * Stored as `pbkdf2$<iterations>$<salt>$<hash>`, base64. 100 000 iterations is
 * the most Cloudflare Workers allow.
 */
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export const MIN_PASSWORD_LENGTH = 10;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

/** Compare without stopping at the first difference, so timing says nothing about where they differ. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Compare two strings (e.g. a submitted password with a configured one) in constant time. */
export function constantTimeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return constantTimeEqual(enc.encode(a), enc.encode(b));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return ['pbkdf2', ITERATIONS, toBase64(salt), toBase64(hash)].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  const actual = await derive(password, fromBase64(salt), Number(iterations));
  return constantTimeEqual(actual, fromBase64(hash));
}

let dummyHash: Promise<string> | null = null;

/** Spend the same time as a real check when there is no account, so timing does not reveal which emails exist. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}
