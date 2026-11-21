import type { AppLoadContext } from 'react-router';
import { authCookies } from '../auth/session.server';
import { getConfig } from '../config/env';
import { CLIENT_ID, CLIENT_SECRET, ISSUER } from './oidc';
import { createTestD1 } from './d1';
import { createTestR2 } from './r2';

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createTestD1(),
    ATTACHMENTS: createTestR2(),
    APP_ENV: 'test',
    LOG_LEVEL: 'error',
    LAIMONID_ISSUER: ISSUER,
    LAIMONID_CLIENT_ID: CLIENT_ID,
    LAIMONID_CLIENT_SECRET: CLIENT_SECRET,
    SESSION_SECRET: 's'.repeat(32),
    BOOTSTRAP_ADMIN_EMAILS: 'admin@hedgile.test',
    LAIMON_MODEL: 'claude-opus-5-5',
    ...overrides,
  } as Env;
}

export function contextFor(env: Env): AppLoadContext {
  return { cloudflare: { env, ctx: {} as ExecutionContext } } as AppLoadContext;
}

/** A Cookie header for a signed-in session, as the callback would set it. */
export async function sessionCookie(
  env: Env,
  userId: string,
  organisationId: string
): Promise<string> {
  const { sessions } = authCookies(getConfig(env));
  const session = await sessions.getSession();
  session.set('userId', userId);
  session.set('organisationId', organisationId);
  return (await sessions.commitSession(session)).split(';')[0] ?? '';
}

/** Create an organisation with one user in it; returns their ids. */
export async function seedOrgWithUser(
  db: D1Database,
  opts: { orgId: string; orgName: string; userId: string; email: string; role?: 'admin' | 'user' }
): Promise<void> {
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO organisations (id, slug, name) VALUES (?, ?, ?)')
      .bind(opts.orgId, opts.orgId, opts.orgName),
    db
      .prepare(
        "INSERT INTO users (id, issuer, subject, email) VALUES (?, 'https://id.test.laimon', ?, ?)"
      )
      .bind(opts.userId, opts.userId, opts.email),
    db
      .prepare(
        'INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(`mem_${opts.userId}`, opts.orgId, opts.userId, opts.email, opts.role ?? 'user'),
  ]);
}
