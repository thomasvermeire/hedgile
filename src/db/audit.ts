import { newId } from './ids.js';

export interface AuditEntry {
  organisationId: string;
  userId: string | null;
  action: string;
  objectType: string;
  objectId?: string | null;
  details?: Record<string, unknown>;
}

export function auditStatement(db: D1Database, entry: AuditEntry): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (id, organisation_id, user_id, action, object_type, object_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId('aud'),
      entry.organisationId,
      entry.userId,
      entry.action,
      entry.objectType,
      entry.objectId ?? null,
      entry.details ? JSON.stringify(entry.details) : null
    );
}

export async function audit(db: D1Database, entry: AuditEntry): Promise<void> {
  await auditStatement(db, entry).run();
}
