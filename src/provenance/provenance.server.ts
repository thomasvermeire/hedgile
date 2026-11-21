import { z } from 'zod';
import { newId } from '../db/ids.js';
import type { Tenant } from '../tenancy/tenant.js';
import {
  provenanceEntry,
  provenanceInput,
  type ProvenanceEntryInput,
  type ProvenanceInput,
  type ProvenanceRecord,
  type ProvenanceResult,
} from './provenance.js';

/**
 * The statement that records where a value came from. Put it in the same
 * `batch()` as the write of the value itself. Throws a ZodError on a bad entry.
 */
export function provenanceStatement(
  tenant: Tenant,
  entry: ProvenanceEntryInput
): D1PreparedStatement {
  const e = provenanceEntry.parse(entry);
  return tenant.db
    .prepare(
      `INSERT INTO value_provenance
         (id, organisation_id, object_type, object_id, field, value, trigger, mode, formula, inputs, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId('prv'),
      tenant.organisationId,
      e.objectType,
      e.objectId,
      e.field,
      e.value,
      e.trigger,
      e.mode,
      e.formula ?? null,
      e.inputs?.length ? JSON.stringify(e.inputs) : null,
      tenant.userId
    );
}

interface Row extends Omit<ProvenanceRecord, 'inputs'> {
  inputs: string | null;
}

function parseInputs(raw: string | null): ProvenanceInput[] | null {
  if (!raw) return null;
  try {
    const parsed = z.array(provenanceInput).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The latest provenance of one field of one object, with older entries (newest first). */
export async function getProvenance(
  tenant: Tenant,
  objectType: string,
  objectId: string,
  field: string
): Promise<ProvenanceResult | null> {
  const { results } = await tenant.db
    .prepare(
      `SELECT p.id, p.object_type AS objectType, p.object_id AS objectId, p.field, p.value,
              p.trigger, p.mode, p.formula, p.inputs, p.user_id AS userId,
              u.name AS userName, u.email AS userEmail, p.created_at AS createdAt
         FROM value_provenance p LEFT JOIN users u ON u.id = p.user_id
        WHERE p.organisation_id = ? AND p.object_type = ? AND p.object_id = ? AND p.field = ?
        ORDER BY p.created_at DESC, p.rowid DESC`
    )
    .bind(tenant.organisationId, objectType, objectId, field)
    .all<Row>();
  const history = results.map((r) => ({ ...r, inputs: parseInputs(r.inputs) }));
  const latest = history[0];
  return latest ? { latest, history: history.slice(1) } : null;
}
