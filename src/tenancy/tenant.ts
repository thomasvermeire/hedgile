/**
 * Who is asking, and for which organisation. Every read and write of
 * organisation-owned data takes a Tenant and filters on its organisationId,
 * so one organisation's data is never visible to another.
 */
export type Role = 'admin' | 'user';

export interface Tenant {
  db: D1Database;
  organisationId: string;
  organisationName: string;
  userId: string;
  email: string;
  userName: string | null;
  role: Role;
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do this') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function requireAdmin(tenant: Tenant): void {
  if (tenant.role !== 'admin') throw new ForbiddenError('Only an admin can do this');
}
