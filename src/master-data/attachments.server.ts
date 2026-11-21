import type { Tenant } from '../tenancy/tenant.js';

export interface Attachment {
  id: string;
  objectType: string;
  objectId: string;
  filename: string;
  contentType: string;
  size: number;
  r2Key: string;
}

const columns =
  'id, object_type AS objectType, object_id AS objectId, filename, content_type AS contentType, size, r2_key AS r2Key';

export async function listAttachments(tenant: Tenant, objectType: string): Promise<Attachment[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT ${columns} FROM attachments WHERE organisation_id = ? AND object_type = ? ORDER BY created_at`
    )
    .bind(tenant.organisationId, objectType)
    .all<Attachment>();
  return results;
}

export async function getAttachment(tenant: Tenant, id: string): Promise<Attachment | null> {
  return tenant.db
    .prepare(`SELECT ${columns} FROM attachments WHERE organisation_id = ? AND id = ?`)
    .bind(tenant.organisationId, id)
    .first<Attachment>();
}
