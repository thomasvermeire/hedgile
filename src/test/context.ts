import type { AppLoadContext } from 'react-router';
import { hashPassword } from '../auth/password';
import { sessionStorage } from '../auth/session.server';
import { getConfig } from '../config/env';
import { createTestD1 } from './d1';
import { createTestR2 } from './r2';

export const BOOTSTRAP_EMAIL = 'admin@hedgile.test';
export const BOOTSTRAP_PASSWORD = 'first-admin-password';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createTestD1(),
    ATTACHMENTS: createTestR2(),
    APP_ENV: 'test',
    LOG_LEVEL: 'error',
    SESSION_SECRET: 's'.repeat(32),
    BOOTSTRAP_ADMIN_EMAIL: BOOTSTRAP_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: BOOTSTRAP_PASSWORD,
    LAIMON_MODEL: 'claude-opus-5-5',
    ...overrides,
  } as Env;
}

export function contextFor(env: Env): AppLoadContext {
  return { cloudflare: { env, ctx: {} as ExecutionContext } } as AppLoadContext;
}

/** A Cookie header for a signed-in session, as the sign-in action would set it. */
export async function sessionCookie(
  env: Env,
  userId: string,
  organisationId: string,
  sessionVersion = 0
): Promise<string> {
  const sessions = sessionStorage(getConfig(env));
  const session = await sessions.getSession();
  session.set('userId', userId);
  session.set('organisationId', organisationId);
  session.set('sessionVersion', sessionVersion);
  return (await sessions.commitSession(session)).split(';')[0] ?? '';
}

/** Create an organisation with one password user in it. */
export async function seedOrgWithUser(
  db: D1Database,
  opts: {
    orgId: string;
    orgName: string;
    userId: string;
    email: string;
    role?: 'admin' | 'user';
    password?: string;
  }
): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO organisations (id, slug, name) VALUES (?, ?, ?)')
      .bind(opts.orgId, opts.orgId, opts.orgName),
    db
      .prepare(
        "INSERT INTO users (id, issuer, subject, email, password_hash) VALUES (?, 'local', ?, ?, ?)"
      )
      .bind(
        opts.userId,
        opts.userId,
        opts.email,
        opts.password ? await hashPassword(opts.password) : null
      ),
    db
      .prepare(
        'INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(`mem_${opts.userId}`, opts.orgId, opts.userId, opts.email, opts.role ?? 'user'),
  ]);
}
