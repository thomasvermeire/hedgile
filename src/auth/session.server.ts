import { createCookieSessionStorage } from 'react-router';
import type { AppConfig } from '../config/env.js';

export interface SessionData {
  userId: string;
  organisationId: string;
  /** The user's session_version when they signed in; a password change bumps it. */
  sessionVersion: number;
}

function build(config: AppConfig) {
  return createCookieSessionStorage<SessionData>({
    cookie: {
      name: 'hedgile_session',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.APP_ENV !== 'development',
      path: '/',
      maxAge: 60 * 60 * 12,
      secrets: [config.SESSION_SECRET],
    },
  });
}

const storages = new WeakMap<AppConfig, ReturnType<typeof build>>();

export function sessionStorage(config: AppConfig): ReturnType<typeof build> {
  let storage = storages.get(config);
  if (!storage) {
    storage = build(config);
    storages.set(config, storage);
  }
  return storage;
}

/** Only same-site paths, so the sign-in cannot be used to redirect elsewhere. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return '/';
  if (value.startsWith('/auth/')) return '/';
  return value;
}
