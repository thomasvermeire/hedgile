import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import type { Tenant } from '../tenancy/tenant.js';

// Plant interface
export interface Plant {
  id: string;
  companyId: string;
  internalNumber: string;
  code: string;
  description: string;
  address: string | null;
}

// Storage Location interface
export interface StorageLocation {
  id: string;
  plantId: string;
  code: string;
  description: string;
}

// Input schemas
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const plantInput = z.object({
  companyId: z.string().min(1, 'Select a company'),
  internalNumber: z.string().trim().min(1, 'Enter an internal number').max(50),
  code: z.string().trim().min(1, 'Enter a code').max(50),
  description: z.string().trim().min(1, 'Enter a description').max(200),
  address: optionalText,
});
export type PlantInput = z.infer<typeof plantInput>;

export const storageLocationInput = z.object({
  plantId: z.string().min(1, 'Select a plant'),
  code: z.string().trim().min(1, 'Enter a code').max(50),
  description: z.string().trim().min(1, 'Enter a description').max(200),
});
export type StorageLocationInput = z.infer<typeof storageLocationInput>;

// Database columns
const plantColumns =
  'id, company_id AS companyId, internal_number AS internalNumber, code, description, address';
const storageLocationColumns = 'id, plant_id AS plantId, code, description';

// Plant CRUD operations
export async function listPlants(tenant: Tenant, companyId?: string): Promise<Plant[]> {
  if (companyId) {
    const { results } = await tenant.db
      .prepare(
        `SELECT ${plantColumns} FROM plants WHERE organisation_id = ? AND company_id = ? ORDER BY code`
      )
      .bind(tenant.organisationId, companyId)
      .all<Plant>();
    return results;
  }
  const { results } = await tenant.db
    .prepare(`SELECT ${plantColumns} FROM plants WHERE organisation_id = ? ORDER BY code`)
    .bind(tenant.organisationId)
    .all<Plant>();
  return results;
}

export async function getPlant(tenant: Tenant, id: string): Promise<Plant | null> {
  return tenant.db
    .prepare(`SELECT ${plantColumns} FROM plants WHERE organisation_id = ? AND id = ?`)
    .bind(tenant.organisationId, id)
    .first<Plant>();
}

export async function createPlant(
  tenant: Tenant,
  input: PlantInput,
  auditDetails?: Record<string, unknown>
): Promise<string> {
  const id = newId('pl');
  await tenant.db.batch([
    tenant.db
      .prepare(
        'INSERT INTO plants (id, organisation_id, company_id, internal_number, code, description, address) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        tenant.organisationId,
        input.companyId,
        input.internalNumber,
        input.code,
        input.description,
        input.address
      ),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'plant.created',
      objectType: 'plant',
      objectId: id,
      details: auditDetails,
    }),
  ]);
  return id;
}

/** Returns false when the plant does not exist in this organisation. */
export async function updatePlant(
  tenant: Tenant,
  id: string,
  input: PlantInput
): Promise<boolean> {
  const { results } = await tenant.db
    .prepare(
      `UPDATE plants SET company_id = ?, internal_number = ?, code = ?, description = ?, address = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE organisation_id = ? AND id = ? RETURNING id`
    )
    .bind(
      input.companyId,
      input.internalNumber,
      input.code,
      input.description,
      input.address,
      tenant.organisationId,
      id
    )
    .all();
  if (results.length === 0) return false;
  await auditStatement(tenant.db, {
    organisationId: tenant.organisationId,
    userId: tenant.userId,
    action: 'plant.updated',
    objectType: 'plant',
    objectId: id,
  }).run();
  return true;
}

// Storage Location CRUD operations
export async function listStorageLocations(
  tenant: Tenant,
  plantId?: string
): Promise<StorageLocation[]> {
  if (plantId) {
    const { results } = await tenant.db
      .prepare(
        `SELECT ${storageLocationColumns} FROM storage_locations WHERE organisation_id = ? AND plant_id = ? ORDER BY code`
      )
      .bind(tenant.organisationId, plantId)
      .all<StorageLocation>();
    return results;
  }
  const { results } = await tenant.db
    .prepare(`SELECT ${storageLocationColumns} FROM storage_locations WHERE organisation_id = ? ORDER BY code`)
    .bind(tenant.organisationId)
    .all<StorageLocation>();
  return results;
}

export async function getStorageLocation(
  tenant: Tenant,
  id: string
): Promise<StorageLocation | null> {
  return tenant.db
    .prepare(`SELECT ${storageLocationColumns} FROM storage_locations WHERE organisation_id = ? AND id = ?`)
    .bind(tenant.organisationId, id)
    .first<StorageLocation>();
}

export async function createStorageLocation(
  tenant: Tenant,
  input: StorageLocationInput,
  auditDetails?: Record<string, unknown>
): Promise<string> {
  const id = newId('sl');
  await tenant.db.batch([
    tenant.db
      .prepare(
        'INSERT INTO storage_locations (id, organisation_id, plant_id, code, description) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, tenant.organisationId, input.plantId, input.code, input.description),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'storage_location.created',
      objectType: 'storage_location',
      objectId: id,
      details: auditDetails,
    }),
  ]);
  return id;
}

/** Returns false when the storage location does not exist in this organisation. */
export async function updateStorageLocation(
  tenant: Tenant,
  id: string,
  input: StorageLocationInput
): Promise<boolean> {
  const { results } = await tenant.db
    .prepare(
      `UPDATE storage_locations SET plant_id = ?, code = ?, description = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE organisation_id = ? AND id = ? RETURNING id`
    )
    .bind(input.plantId, input.code, input.description, tenant.organisationId, id)
    .all();
  if (results.length === 0) return false;
  await auditStatement(tenant.db, {
    organisationId: tenant.organisationId,
    userId: tenant.userId,
    action: 'storage_location.updated',
    objectType: 'storage_location',
    objectId: id,
  }).run();
  return true;
}

// Helper to get storage locations for a specific plant
export async function getStorageLocationsForPlant(
  tenant: Tenant,
  plantId: string
): Promise<StorageLocation[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT ${storageLocationColumns} FROM storage_locations WHERE organisation_id = ? AND plant_id = ? ORDER BY code`
    )
    .bind(tenant.organisationId, plantId)
    .all<StorageLocation>();
  return results;
}
