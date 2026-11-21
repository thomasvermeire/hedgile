import type { Tenant } from '../tenancy/tenant.js';

export interface MetalReferenceRow {
  id: string;
  metal: string;
  name: string;
  source: string;
}

export async function listActiveReferences(tenant: Tenant): Promise<MetalReferenceRow[]> {
  const { results } = await tenant.db
    .prepare(
      'SELECT id, metal, name, source FROM metal_references WHERE organisation_id = ? AND active = 1 ORDER BY metal, name'
    )
    .bind(tenant.organisationId)
    .all<MetalReferenceRow>();
  return results;
}

export async function getReference(tenant: Tenant, id: string): Promise<MetalReferenceRow | null> {
  return tenant.db
    .prepare(
      'SELECT id, metal, name, source FROM metal_references WHERE organisation_id = ? AND id = ?'
    )
    .bind(tenant.organisationId, id)
    .first<MetalReferenceRow>();
}
