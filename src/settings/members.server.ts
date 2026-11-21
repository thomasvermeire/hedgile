import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { requireAdmin, type Role, type Tenant } from '../tenancy/tenant.js';

export interface Member {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  pending: boolean;
}

export const memberInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  role: z.enum(['admin', 'user']),
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
      `SELECT m.id, m.email, u.name, m.role, (m.user_id IS NULL) AS pending
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

/** Invite by email; the person joins on their first LaimonID sign-in with that address. */
export async function inviteMember(
  tenant: Tenant,
  input: z.infer<typeof memberInput>
): Promise<void> {
  requireAdmin(tenant);
  const id = newId('mem');
  await tenant.db.batch([
    tenant.db
      .prepare(
        `INSERT INTO memberships (id, organisation_id, user_id, email, role)
         VALUES (?, ?, (SELECT id FROM users WHERE email = ? LIMIT 1), ?, ?)
         ON CONFLICT (organisation_id, email) DO UPDATE SET role = excluded.role`
      )
      .bind(id, tenant.organisationId, input.email, input.email, input.role),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'membership.invited',
      objectType: 'membership',
      details: input,
    }),
  ]);
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
