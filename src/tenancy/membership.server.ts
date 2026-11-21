import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import {
  burnPasswordCheck,
  constantTimeStringEqual,
  hashPassword,
  verifyPassword,
} from '../auth/password.js';
import type { Role } from './tenant.js';

export const HEDGILE_ORG_ID = 'org_hedgile';
export const LOCAL_ISSUER = 'local';

/** Wrong passwords in a row before the account locks, and for how long. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface Membership {
  organisationId: string;
  organisationName: string;
  role: Role;
}

export interface Bootstrap {
  /** The first admin: signing in with exactly these creates them as admin of Hedgile. */
  email: string | undefined;
  password: string | undefined;
}

export type SignInResult =
  | { ok: true; userId: string; sessionVersion: number; membership: Membership }
  | { ok: false; reason: 'invalid' | 'locked' | 'no_membership' };

interface UserRow {
  id: string;
  passwordHash: string | null;
  failedLogins: number;
  lockedUntil: string | null;
  sessionVersion: number;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Check an email and password. Wrong passwords count towards a temporary lock;
 * the reply never says whether the email exists. The configured bootstrap
 * admin is created on their first sign-in.
 */
export async function signIn(
  db: D1Database,
  rawEmail: string,
  password: string,
  bootstrap: Bootstrap,
  now: Date = new Date()
): Promise<SignInResult> {
  const email = normaliseEmail(rawEmail);
  const user = await db
    .prepare(
      `SELECT id, password_hash AS passwordHash, failed_logins AS failedLogins, locked_until AS lockedUntil,
              session_version AS sessionVersion
       FROM users WHERE issuer = ? AND email = ?`
    )
    .bind(LOCAL_ISSUER, email)
    .first<UserRow>();

  if (!user) {
    if (
      bootstrap.email &&
      bootstrap.password &&
      constantTimeStringEqual(email, normaliseEmail(bootstrap.email)) &&
      constantTimeStringEqual(password, bootstrap.password)
    ) {
      return createBootstrapAdmin(db, email, password);
    }
    await burnPasswordCheck(password);
    return { ok: false, reason: 'invalid' };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > now) {
    await burnPasswordCheck(password);
    return { ok: false, reason: 'locked' };
  }

  const valid = user.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock =
      failed >= MAX_FAILED_LOGINS
        ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString()
        : null;
    await db
      .prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .bind(lock ? 0 : failed, lock, user.id)
      .run();
    return { ok: false, reason: lock ? 'locked' : 'invalid' };
  }

  await db
    .prepare(
      `UPDATE users SET failed_logins = 0, locked_until = NULL, last_sign_in_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    )
    .bind(user.id)
    .run();
  const membership = await findMembership(db, user.id);
  if (!membership) return { ok: false, reason: 'no_membership' };
  return { ok: true, userId: user.id, sessionVersion: user.sessionVersion, membership };
}

async function createBootstrapAdmin(
  db: D1Database,
  email: string,
  password: string
): Promise<SignInResult> {
  const userId = newId('usr');
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, issuer, subject, email, password_hash, last_sign_in_at)
         VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .bind(userId, LOCAL_ISSUER, userId, email, await hashPassword(password)),
    db
      .prepare(
        `INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES (?, ?, ?, ?, 'admin')
         ON CONFLICT (organisation_id, email) DO UPDATE SET user_id = excluded.user_id, role = 'admin'`
      )
      .bind(newId('mem'), HEDGILE_ORG_ID, userId, email),
    auditStatement(db, {
      organisationId: HEDGILE_ORG_ID,
      userId,
      action: 'membership.bootstrap_admin',
      objectType: 'user',
      objectId: userId,
    }),
  ]);
  const membership = await findMembership(db, userId);
  if (!membership) return { ok: false, reason: 'no_membership' };
  return { ok: true, userId, sessionVersion: 0, membership };
}

/**
 * Create a password account, or set a new password on an existing one.
 * Returns the user id. Bumping session_version signs out the account's sessions.
 */
export async function setPassword(
  db: D1Database,
  rawEmail: string,
  password: string,
  name?: string | null
): Promise<string> {
  const email = normaliseEmail(rawEmail);
  const hash = await hashPassword(password);
  const existing = await db
    .prepare('SELECT id FROM users WHERE issuer = ? AND email = ?')
    .bind(LOCAL_ISSUER, email)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare(
        `UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL,
           session_version = session_version + 1, name = COALESCE(?, name) WHERE id = ?`
      )
      .bind(hash, name ?? null, existing.id)
      .run();
    return existing.id;
  }
  const userId = newId('usr');
  await db
    .prepare(
      'INSERT INTO users (id, issuer, subject, email, name, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(userId, LOCAL_ISSUER, userId, email, name ?? null, hash)
    .run();
  return userId;
}

/** The user's membership: in organisation Hedgile when they have one there, else their oldest. */
export async function findMembership(
  db: D1Database,
  userId: string,
  organisationId?: string
): Promise<Membership | null> {
  const row = await db
    .prepare(
      `SELECT m.organisation_id AS organisationId, o.name AS organisationName, m.role AS role
       FROM memberships m JOIN organisations o ON o.id = m.organisation_id
       WHERE m.user_id = ? AND (? IS NULL OR m.organisation_id = ?)
       ORDER BY (m.organisation_id = '${HEDGILE_ORG_ID}') DESC, m.created_at ASC LIMIT 1`
    )
    .bind(userId, organisationId ?? null, organisationId ?? null)
    .first<Membership>();
  return row ?? null;
}
