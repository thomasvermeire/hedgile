import { auditStatement } from '../db/audit.js';
import { setPassword } from '../tenancy/membership.server.js';
import type { Tenant } from '../tenancy/tenant.js';
import { verifyPassword } from './password.js';

export class WrongPasswordError extends Error {
  constructor() {
    super('Your current password is not right');
    this.name = 'WrongPasswordError';
  }
}

/**
 * Change your own password. Returns the new session version: the caller puts
 * it in this session, so this browser stays signed in and all others are not.
 */
export async function changeOwnPassword(
  tenant: Tenant,
  current: string,
  next: string
): Promise<number> {
  const user = await tenant.db
    .prepare('SELECT email, password_hash AS passwordHash FROM users WHERE id = ?')
    .bind(tenant.userId)
    .first<{ email: string; passwordHash: string | null }>();
  if (!user?.passwordHash || !(await verifyPassword(current, user.passwordHash)))
    throw new WrongPasswordError();
  await setPassword(tenant.db, user.email, next);
  await auditStatement(tenant.db, {
    organisationId: tenant.organisationId,
    userId: tenant.userId,
    action: 'user.password_changed',
    objectType: 'user',
    objectId: tenant.userId,
  }).run();
  const row = await tenant.db
    .prepare('SELECT session_version AS v FROM users WHERE id = ?')
    .bind(tenant.userId)
    .first<{ v: number }>();
  return row?.v ?? 0;
}
