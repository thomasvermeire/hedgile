import { data, redirect, type AppLoadContext } from 'react-router';
import { ConfigError, getConfig, type AppConfig } from '../config/env.js';
import { createLogger } from '../utils/logger.js';
import { findMembership } from '../tenancy/membership.server.js';
import type { Tenant } from '../tenancy/tenant.js';
import { authCookies } from './session.server.js';

export interface RequestArgs {
  request: Request;
  context: AppLoadContext;
}

export function appEnv(context: AppLoadContext): Env {
  return context.cloudflare.env;
}

/**
 * The validated settings. Invalid settings become a 503 page naming each
 * setting (never its value), logged once per request through the one logger.
 */
export function appConfig(context: AppLoadContext): AppConfig {
  try {
    return getConfig(appEnv(context));
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    createLogger('error').error('Hedgile is not configured', { problems: error.problems });
    throw data({ kind: 'config', settings: error.problems.map((p) => p.setting) }, { status: 503 });
  }
}

/**
 * Refuse an unauthenticated request: API calls get 401, pages go to sign-in.
 */
function refuse(request: Request, headers?: HeadersInit): never {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    throw Response.json({ error: 'unauthenticated' }, { status: 401, headers });
  }
  const returnTo = `${url.pathname}${url.search}`;
  throw redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, { headers });
}

/**
 * The signed-in user and their organisation, checked against the database on
 * every request (a removed membership takes effect at once). Throws otherwise.
 */
export async function requireTenant({ request, context }: RequestArgs): Promise<Tenant> {
  const env = appEnv(context);
  const config = appConfig(context);
  const { sessions } = authCookies(config);
  const session = await sessions.getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');
  const organisationId = session.get('organisationId');
  if (!userId || !organisationId) refuse(request);

  const [membership, user] = await Promise.all([
    findMembership(env.DB, userId, organisationId),
    env.DB.prepare('SELECT email, name FROM users WHERE id = ?')
      .bind(userId)
      .first<{ email: string; name: string | null }>(),
  ]);
  if (!membership || !user) {
    refuse(request, { 'Set-Cookie': await sessions.destroySession(session) });
  }

  return {
    db: env.DB,
    organisationId: membership.organisationId,
    organisationName: membership.organisationName,
    role: membership.role,
    userId,
    email: user.email,
    userName: user.name,
  };
}
