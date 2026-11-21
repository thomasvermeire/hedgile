import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import type { Tenant } from '../tenancy/tenant.js';
import { METALS } from './metals.js';

export interface Material {
  id: string;
  code: string;
  name: string;
  metal: string;
}

export const materialInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a code')
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'Letters, digits and dashes only'),
  name: z.string().trim().min(1, 'Enter a name').max(200),
  metal: z.enum(METALS, { error: 'Choose a metal from the list' }),
});
export type MaterialInput = z.infer<typeof materialInput>;

export class DuplicateCodeError extends Error {
  constructor() {
    super('Another material already has this code');
    this.name = 'DuplicateCodeError';
  }
}

function isUniqueViolation(error: unknown): boolean {
  return String(error).includes('UNIQUE');
}

export async function listMaterials(tenant: Tenant): Promise<Material[]> {
  const { results } = await tenant.db
    .prepare('SELECT id, code, name, metal FROM materials WHERE organisation_id = ? ORDER BY code')
    .bind(tenant.organisationId)
    .all<Material>();
  return results;
}

export async function getMaterial(tenant: Tenant, id: string): Promise<Material | null> {
  return tenant.db
    .prepare('SELECT id, code, name, metal FROM materials WHERE organisation_id = ? AND id = ?')
    .bind(tenant.organisationId, id)
    .first<Material>();
}

export async function createMaterial(tenant: Tenant, input: MaterialInput): Promise<string> {
  const id = newId('mat');
  try {
    await tenant.db.batch([
      tenant.db
        .prepare(
          'INSERT INTO materials (id, organisation_id, code, name, metal) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(id, tenant.organisationId, input.code, input.name, input.metal),
      auditStatement(tenant.db, {
        organisationId: tenant.organisationId,
        userId: tenant.userId,
        action: 'material.created',
        objectType: 'material',
        objectId: id,
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCodeError();
    throw error;
  }
  return id;
}

export async function updateMaterial(
  tenant: Tenant,
  id: string,
  input: MaterialInput
): Promise<boolean> {
  try {
    const { results } = await tenant.db
      .prepare(
        `UPDATE materials SET code = ?, name = ?, metal = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE organisation_id = ? AND id = ? RETURNING id`
      )
      .bind(input.code, input.name, input.metal, tenant.organisationId, id)
      .all();
    if (results.length === 0) return false;
    await auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'material.updated',
      objectType: 'material',
      objectId: id,
    }).run();
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCodeError();
    throw error;
  }
}
