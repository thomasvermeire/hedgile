import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { MIN_PASSWORD_LENGTH } from '../auth/password.js';
import { LOCAL_ISSUER, normaliseEmail, setPassword } from '../tenancy/membership.server.js';
import { ForbiddenError, requireAdmin, type Role, type Tenant } from '../tenancy/tenant.js';

export interface Member {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Has never signed in (e.g. added with an initial password). */
  pending: boolean;
}

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200, 'Use at most 200 characters');

export const memberInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  name: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  role: z.enum(['admin', 'user']),
  password,
});

export const passwordResetInput = z.object({ password });

export const passwordChangeInput = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match',
  });

export const organisationInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  baseCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, e.g. USD'),
});

export class LastAdminError extends Error {
  constructor() {
    super('An organisation needs at least one admin');
    this.name = 'LastAdminError';
  }
}

export async function listMembers(tenant: Tenant): Promise<Member[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT m.id, m.email, u.name, m.role, (u.last_sign_in_at IS NULL) AS pending
       FROM memberships m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.organisation_id = ? ORDER BY m.email`
    )
    .bind(tenant.organisationId)
    .all<Omit<Member, 'pending'> & { pending: number }>();
  return results.map((r) => ({ ...r, pending: Boolean(r.pending) }));
}

export async function getOrganisation(
  tenant: Tenant
): Promise<{ name: string; baseCurrency: string }> {
  const row = await tenant.db
    .prepare('SELECT name, base_currency AS baseCurrency FROM organisations WHERE id = ?')
    .bind(tenant.organisationId)
    .first<{ name: string; baseCurrency: string }>();
  if (!row) throw new Error('Organisation not found');
  return row;
}

export async function updateOrganisation(
  tenant: Tenant,
  input: z.infer<typeof organisationInput>
): Promise<void> {
  requireAdmin(tenant);
  await tenant.db.batch([
    tenant.db
      .prepare('UPDATE organisations SET name = ?, base_currency = ? WHERE id = ?')
      .bind(input.name, input.baseCurrency, tenant.organisationId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'organisation.updated',
      objectType: 'organisation',
      objectId: tenant.organisationId,
      details: input,
    }),
  ]);
}

export class MemberExistsError extends Error {
  constructor() {
    super('This email is already a member');
    this.name = 'MemberExistsError';
  }
}

/**
 * Add a member with an initial password they can change under "My account".
 * Someone who already has an account (e.g. in another organisation) keeps their
 * own password: an admin of one organisation can never set it.
 */
export async function addMember(tenant: Tenant, input: z.infer<typeof memberInput>): Promise<void> {
  requireAdmin(tenant);
  const email = normaliseEmail(input.email);
  const taken = await tenant.db
    .prepare('SELECT 1 FROM memberships WHERE organisation_id = ? AND email = ?')
    .bind(tenant.organisationId, email)
    .first();
  if (taken) throw new MemberExistsError();
  const existing = await tenant.db
    .prepare('SELECT id FROM users WHERE issuer = ? AND email = ?')
    .bind(LOCAL_ISSUER, email)
    .first<{ id: string }>();
  const userId = existing?.id ?? (await setPassword(tenant.db, email, input.password, input.name));
  await tenant.db.batch([
    tenant.db
      .prepare(
        'INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(newId('mem'), tenant.organisationId, userId, email, input.role),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'membership.added',
      objectType: 'membership',
      details: { email, role: input.role, existingAccount: Boolean(existing) },
    }),
  ]);
}

/**
 * An admin sets a new password for a member, e.g. one who forgot theirs. Only
 * for accounts that belong to this organisation alone; signs out their sessions.
 */
export async function resetMemberPassword(
  tenant: Tenant,
  membershipId: string,
  newPassword: string
): Promise<boolean> {
  requireAdmin(tenant);
  const member = await tenant.db
    .prepare(
      `SELECT m.user_id AS userId, m.email,
              (SELECT COUNT(*) FROM memberships o WHERE o.user_id = m.user_id AND o.organisation_id != m.organisation_id) AS elsewhere
       FROM memberships m WHERE m.organisation_id = ? AND m.id = ?`
    )
    .bind(tenant.organisationId, membershipId)
    .first<{ userId: string | null; email: string; elsewhere: number }>();
  if (!member?.userId) return false;
  if (member.elsewhere > 0) {
    throw new ForbiddenError(
      'This person is also in another organisation: they change their password themselves'
    );
  }
  await setPassword(tenant.db, member.email, newPassword);
  await auditStatement(tenant.db, {
    organisationId: tenant.organisationId,
    userId: tenant.userId,
    action: 'membership.password_reset',
    objectType: 'membership',
    objectId: membershipId,
  }).run();
  return true;
}

export async function changeRole(
  tenant: Tenant,
  membershipId: string,
  role: Role
): Promise<boolean> {
  requireAdmin(tenant);
  if (role === 'user') {
    const admins = await tenant.db
      .prepare(
        `SELECT COUNT(*) AS n FROM memberships WHERE organisation_id = ? AND role = 'admin' AND id != ?`
      )
      .bind(tenant.organisationId, membershipId)
      .first<number>('n');
    if (!admins) throw new LastAdminError();
  }
  const [result] = await tenant.db.batch([
    tenant.db
      .prepare('UPDATE memberships SET role = ? WHERE organisation_id = ? AND id = ? RETURNING id')
      .bind(role, tenant.organisationId, membershipId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'membership.role_changed',
      objectType: 'membership',
      objectId: membershipId,
      details: { role },
    }),
  ]);
  return (result?.results?.length ?? 0) > 0;
}
