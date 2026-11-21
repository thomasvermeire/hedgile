import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import type { Role } from './tenant.js';

export const HEDGILE_ORG_ID = 'org_hedgile';

export interface Identity {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface Membership {
  organisationId: string;
  organisationName: string;
  role: Role;
}

export type SignInResult =
  | { ok: true; userId: string; membership: Membership }
  | { ok: false; reason: 'no_membership' | 'email_not_verified' };

/**
 * Turn a verified LaimonID identity into a Hedgile user in an organisation.
 * Order: an existing membership; else an invitation for the verified email;
 * else a bootstrap admin email joins organisation Hedgile as admin; else refused.
 */
export async function resolveSignIn(
  db: D1Database,
  identity: Identity,
  bootstrapAdminEmails: string[]
): Promise<SignInResult> {
  const email = identity.email.trim().toLowerCase();
  const existing = await db
    .prepare('SELECT id FROM users WHERE issuer = ? AND subject = ?')
    .bind(identity.issuer, identity.subject)
    .first<{ id: string }>();
  const userId = existing?.id ?? newId('usr');

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET email = ?, name = ?, last_sign_in_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
      )
      .bind(email, identity.name, userId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO users (id, issuer, subject, email, name, last_sign_in_at)
         VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .bind(userId, identity.issuer, identity.subject, email, identity.name)
      .run();
  }

  let membership = await findMembership(db, userId);
  if (membership) return { ok: true, userId, membership };

  // Claiming by email needs a verified address, or anyone could take an invitation.
  if (!identity.emailVerified) return { ok: false, reason: 'email_not_verified' };

  const claimed = await db
    .prepare('UPDATE memberships SET user_id = ? WHERE user_id IS NULL AND email = ?')
    .bind(userId, email)
    .run();
  if (claimed.meta.changes === 0 && bootstrapAdminEmails.includes(email)) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES (?, ?, ?, ?, 'admin')
           ON CONFLICT (organisation_id, email) DO UPDATE SET user_id = excluded.user_id`
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
  }

  membership = await findMembership(db, userId);
  return membership ? { ok: true, userId, membership } : { ok: false, reason: 'no_membership' };
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
