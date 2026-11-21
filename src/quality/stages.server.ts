import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';

export type StageStatus = 'active' | 'inactive' | 'locked';

export interface QualityStage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: StageStatus;
  sortOrder: number;
}

/**
 * Rules for locked stages: a locked stage is a pre-set stage that is not
 * available yet. It is shown with a lock and users cannot activate it; only
 * active <-> inactive is possible, and only for unlocked stages. Its name,
 * description and order can still be edited. Stages users add start active.
 */
export class StageCodeTakenError extends Error {
  constructor(code: string) {
    super(`A quality stage with code ${code} already exists`);
    this.name = 'StageCodeTakenError';
  }
}

export class StageLockedError extends Error {
  constructor() {
    super('A locked stage cannot be activated or deactivated');
    this.name = 'StageLockedError';
  }
}

const description = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

const sortOrder = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : undefined))
  .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 9999), {
    message: 'Enter a whole number from 0 to 9999',
  });

export const stageInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  description,
  sortOrder,
});
export type StageInput = z.infer<typeof stageInput>;

export const newStageInput = stageInput.extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use two letters, e.g. TA'),
});
export type NewStageInput = z.infer<typeof newStageInput>;

const columns = 'id, code, name, description, status, sort_order AS sortOrder';

export async function listQualityStages(tenant: Tenant): Promise<QualityStage[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT ${columns} FROM quality_stages WHERE organisation_id = ? ORDER BY sort_order, code`
    )
    .bind(tenant.organisationId)
    .all<QualityStage>();
  return results;
}

/** The stages later quality modules may offer: active ones, in order. */
export async function activeQualityStages(tenant: Tenant): Promise<QualityStage[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT ${columns} FROM quality_stages
         WHERE organisation_id = ? AND status = 'active' ORDER BY sort_order, code`
    )
    .bind(tenant.organisationId)
    .all<QualityStage>();
  return results;
}

export async function getQualityStage(tenant: Tenant, id: string): Promise<QualityStage | null> {
  return tenant.db
    .prepare(`SELECT ${columns} FROM quality_stages WHERE organisation_id = ? AND id = ?`)
    .bind(tenant.organisationId, id)
    .first<QualityStage>();
}

/** Add a stage (admin only). It starts active. Throws StageCodeTakenError on a duplicate code. */
export async function addQualityStage(tenant: Tenant, input: NewStageInput): Promise<string> {
  requireAdmin(tenant);
  const taken = await tenant.db
    .prepare('SELECT 1 FROM quality_stages WHERE organisation_id = ? AND code = ?')
    .bind(tenant.organisationId, input.code)
    .first();
  if (taken) throw new StageCodeTakenError(input.code);
  const id = newId('qs');
  try {
    await tenant.db.batch([
      tenant.db
        .prepare(
          `INSERT INTO quality_stages (id, organisation_id, code, name, description, status, sort_order)
           VALUES (?, ?, ?, ?, ?, 'active',
             COALESCE(?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM quality_stages WHERE organisation_id = ?)))`
        )
        .bind(
          id,
          tenant.organisationId,
          input.code,
          input.name,
          input.description,
          input.sortOrder ?? null,
          tenant.organisationId
        ),
      auditStatement(tenant.db, {
        organisationId: tenant.organisationId,
        userId: tenant.userId,
        action: 'quality_stage.created',
        objectType: 'quality_stage',
        objectId: id,
        details: { code: input.code, name: input.name },
      }),
    ]);
  } catch (error) {
    // A concurrent add of the same code loses the unique constraint.
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      throw new StageCodeTakenError(input.code);
    }
    throw error;
  }
  return id;
}

/** Edit name, description and order (admin only). False when the stage is not in this organisation. */
export async function updateQualityStage(
  tenant: Tenant,
  id: string,
  input: StageInput
): Promise<boolean> {
  requireAdmin(tenant);
  const current = await getQualityStage(tenant, id);
  if (!current) return false;
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE quality_stages SET name = ?, description = ?, sort_order = ?
           WHERE organisation_id = ? AND id = ?`
      )
      .bind(
        input.name,
        input.description,
        input.sortOrder ?? current.sortOrder,
        tenant.organisationId,
        id
      ),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'quality_stage.updated',
      objectType: 'quality_stage',
      objectId: id,
      details: { code: current.code },
    }),
  ]);
  return true;
}

/**
 * Activate or deactivate a stage (admin only). A locked stage cannot be
 * changed (StageLockedError). False when the stage is not in this organisation.
 */
export async function setQualityStageActive(
  tenant: Tenant,
  id: string,
  active: boolean
): Promise<boolean> {
  requireAdmin(tenant);
  const current = await getQualityStage(tenant, id);
  if (!current) return false;
  if (current.status === 'locked') throw new StageLockedError();
  const status: StageStatus = active ? 'active' : 'inactive';
  if (current.status === status) return true;
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE quality_stages SET status = ?
           WHERE organisation_id = ? AND id = ? AND status <> 'locked'`
      )
      .bind(status, tenant.organisationId, id),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: active ? 'quality_stage.activated' : 'quality_stage.deactivated',
      objectType: 'quality_stage',
      objectId: id,
      details: { code: current.code },
    }),
  ]);
  return true;
}
