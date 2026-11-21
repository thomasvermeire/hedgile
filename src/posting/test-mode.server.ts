import { auditStatement } from '../db/audit.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';

/** Whether the organisation is in test mode (future posting dates allowed). */
export async function getTestMode(tenant: Tenant): Promise<boolean> {
  const row = await tenant.db
    .prepare('SELECT test_mode AS testMode FROM organisations WHERE id = ?')
    .bind(tenant.organisationId)
    .first<{ testMode: number }>();
  if (!row) throw new Error('Organisation not found');
  return row.testMode === 1;
}

/** Admin only; the change is written to the audit trail in the same batch. */
export async function setTestMode(tenant: Tenant, testMode: boolean): Promise<void> {
  requireAdmin(tenant);
  await tenant.db.batch([
    tenant.db
      .prepare('UPDATE organisations SET test_mode = ? WHERE id = ?')
      .bind(testMode ? 1 : 0, tenant.organisationId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'organisation.test_mode_changed',
      objectType: 'organisation',
      objectId: tenant.organisationId,
      details: { testMode },
    }),
  ]);
}
