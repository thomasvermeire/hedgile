import { auditStatement } from '../db/audit.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';
import { parameterDefinitions, type ParameterKey, type ParameterValue } from './registry.js';

export const PARAMETER_CHANGED = 'parameter.changed';

export class InvalidParameterError extends Error {
  constructor(
    public readonly key: ParameterKey,
    message: string
  ) {
    super(message);
    this.name = 'InvalidParameterError';
  }
}

/**
 * The current value, read from the database at every call (never cached), or the
 * registry default when the organisation has no stored value.
 */
export async function getParameter<K extends ParameterKey>(
  tenant: Tenant,
  key: K
): Promise<ParameterValue<K>> {
  const def = parameterDefinitions[key];
  const row = await tenant.db
    .prepare('SELECT value FROM organisation_parameters WHERE organisation_id = ? AND key = ?')
    .bind(tenant.organisationId, key)
    .first<{ value: string }>();
  if (!row) return def.default as ParameterValue<K>;
  const parsed = def.schema.safeParse(row.value);
  if (!parsed.success) throw new Error(`Stored value of parameter ${key} is invalid`);
  return parsed.data as ParameterValue<K>;
}

/**
 * Admin only. Validates, upserts and writes the audit entry
 * `{ key, oldValue, newValue }` in the same batch. Returns the stored value.
 */
export async function setParameter<K extends ParameterKey>(
  tenant: Tenant,
  key: K,
  value: unknown
): Promise<ParameterValue<K>> {
  requireAdmin(tenant);
  const parsed = parameterDefinitions[key].schema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidParameterError(key, parsed.error.issues[0]?.message ?? 'Invalid value');
  }
  const newValue = parsed.data as ParameterValue<K>;
  const oldValue = await getParameter(tenant, key);
  await tenant.db.batch([
    tenant.db
      .prepare(
        `INSERT INTO organisation_parameters (organisation_id, key, value, updated_at, updated_by)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)
         ON CONFLICT (organisation_id, key) DO UPDATE SET
           value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
      )
      .bind(tenant.organisationId, key, String(newValue), tenant.userId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: PARAMETER_CHANGED,
      objectType: 'parameter',
      objectId: key,
      details: { key, oldValue, newValue },
    }),
  ]);
  return newValue;
}

export interface ParameterChange {
  id: string;
  at: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  oldValue: unknown;
  newValue: unknown;
}

/** Changes of one parameter, newest first. */
export async function parameterHistory(
  tenant: Tenant,
  key: ParameterKey
): Promise<ParameterChange[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT a.id, a.created_at AS at, a.user_id AS userId, u.name AS userName,
              u.email AS userEmail, a.details
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.organisation_id = ? AND a.action = ? AND a.object_type = 'parameter' AND a.object_id = ?
       ORDER BY a.created_at DESC, a.rowid DESC`
    )
    .bind(tenant.organisationId, PARAMETER_CHANGED, key)
    .all<{
      id: string;
      at: string;
      userId: string | null;
      userName: string | null;
      userEmail: string | null;
      details: string | null;
    }>();
  return results.map(({ details, ...rest }) => {
    const d = (details ? JSON.parse(details) : {}) as { oldValue?: unknown; newValue?: unknown };
    return { ...rest, oldValue: d.oldValue ?? null, newValue: d.newValue ?? null };
  });
}

/** The three-way-match tolerance in %, as it is right now. The match calls this when it runs. */
export function threeWayMatchTolerance(tenant: Tenant): Promise<number> {
  return getParameter(tenant, 'three_way_match_tolerance_pct');
}
