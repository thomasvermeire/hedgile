import { createCookie, createCookieSessionStorage } from 'react-router';
import type { AppConfig } from '../config/env.js';
import type { PendingSignIn } from './oidc.server.js';

interface SessionData {
  userId: string;
  organisationId: string;
}

function secure(config: AppConfig): boolean {
  return config.APP_ENV !== 'development';
}

const storages = new WeakMap<AppConfig, ReturnType<typeof build>>();

function build(config: AppConfig) {
  const sessions = createCookieSessionStorage<SessionData>({
    cookie: {
      name: 'hedgile_session',
      httpOnly: true,
      sameSite: 'lax',
      secure: secure(config),
      path: '/',
      maxAge: 60 * 60 * 12,
      secrets: [config.SESSION_SECRET],
    },
  });
  // Holds state, nonce and PKCE verifier between /auth/login and /auth/callback.
  const pendingSignIn = createCookie('hedgile_signin', {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(config),
    path: '/auth',
    maxAge: 60 * 10,
    secrets: [config.SESSION_SECRET],
  });
  return { sessions, pendingSignIn };
}

export function authCookies(config: AppConfig): ReturnType<typeof build> {
  let storage = storages.get(config);
  if (!storage) {
    storage = build(config);
    storages.set(config, storage);
  }
  return storage;
}

export async function readPendingSignIn(
  config: AppConfig,
  request: Request
): Promise<PendingSignIn | null> {
  const value: unknown = await authCookies(config).pendingSignIn.parse(
    request.headers.get('Cookie')
  );
  if (value && typeof value === 'object' && 'state' in value) return value as PendingSignIn;
  return null;
}

/** Only same-site paths, so the sign-in cannot be used to redirect elsewhere. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return '/';
  if (value.startsWith('/auth/')) return '/';
  return value;
}
