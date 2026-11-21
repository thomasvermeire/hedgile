import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { createCompany, type CompanyInput } from '../master-data/companies.server.js';
import type { Tenant } from '../tenancy/tenant.js';
import type { Extractor } from './claude.server.js';
import type { DraftFields } from './kinds.js';
import type { ExtractionKind } from './kinds.server.js';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class InvalidDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentError';
  }
}

export interface Draft {
  id: string;
  kind: string;
  status: 'draft' | 'confirmed' | 'discarded';
  filename: string;
  fields: DraftFields;
  objectId: string | null;
  createdAt: string;
}

function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, '_')
    .trim()
    .slice(0, 120);
  return cleaned || 'document.pdf';
}

/** A PDF by content, not just by name: it must start with %PDF- and stay under the size limit. */
export async function readPdf(file: File): Promise<ArrayBuffer> {
  if (file.size === 0) throw new InvalidDocumentError('The file is empty');
  if (file.size > MAX_PDF_BYTES) throw new InvalidDocumentError('The PDF is larger than 10 MB');
  const buffer = await file.arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)));
  if (head !== '%PDF-') throw new InvalidDocumentError('Only PDF documents can be read');
  return buffer;
}

/**
 * Store the PDF, let Laimon read it into a draft, and log the extraction in
 * the audit trail. Nothing else is written until the user confirms.
 */
export async function createDraft(
  tenant: Tenant,
  bucket: R2Bucket,
  extractor: Extractor,
  kind: ExtractionKind,
  file: File
): Promise<string> {
  const pdf = await readPdf(file);
  const id = newId('drf');
  const filename = safeFilename(file.name);
  const key = `${tenant.organisationId}/drafts/${id}/${filename}`;
  await bucket.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' } });

  let result: Awaited<ReturnType<Extractor['extract']>>;
  try {
    result = await extractor.extract(kind, pdf);
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }

  await tenant.db.batch([
    tenant.db
      .prepare(
        `INSERT INTO extraction_drafts (id, organisation_id, user_id, kind, status, r2_key, filename, content_type, size, fields)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, 'application/pdf', ?, ?)`
      )
      .bind(
        id,
        tenant.organisationId,
        tenant.userId,
        kind.id,
        key,
        filename,
        pdf.byteLength,
        JSON.stringify(result.fields)
      ),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'laimon.extracted',
      objectType: 'extraction_draft',
      objectId: id,
      details: { kind: kind.id, filename, model: result.model, fields: result.fields },
    }),
  ]);
  return id;
}

export async function getDraft(tenant: Tenant, id: string): Promise<Draft | null> {
  const row = await tenant.db
    .prepare(
      `SELECT id, kind, status, filename, fields, object_id AS objectId, created_at AS createdAt
       FROM extraction_drafts WHERE organisation_id = ? AND id = ?`
    )
    .bind(tenant.organisationId, id)
    .first<Omit<Draft, 'fields'> & { fields: string }>();
  return row ? { ...row, fields: JSON.parse(row.fields) as DraftFields } : null;
}

export class DraftClosedError extends Error {
  constructor() {
    super('This draft was already confirmed or discarded');
    this.name = 'DraftClosedError';
  }
}

/**
 * The user checked the draft: create the company from the values they
 * confirmed, attach the PDF to it, close the draft, and record what they changed.
 */
export async function confirmCompanyDraft(
  tenant: Tenant,
  draftId: string,
  input: CompanyInput
): Promise<string> {
  const draft = await tenant.db
    .prepare(
      `SELECT r2_key AS r2Key, filename, content_type AS contentType, size, fields, status
       FROM extraction_drafts WHERE organisation_id = ? AND id = ? AND kind = 'company'`
    )
    .bind(tenant.organisationId, draftId)
    .first<{
      r2Key: string;
      filename: string;
      contentType: string;
      size: number;
      fields: string;
      status: string;
    }>();
  if (!draft) throw new DraftClosedError();
  if (draft.status !== 'draft') throw new DraftClosedError();

  const extracted = JSON.parse(draft.fields) as DraftFields;
  const changedFields = Object.entries(input)
    .filter(([name, value]) => (extracted[name]?.value ?? null) !== (value ?? null))
    .map(([name]) => name);

  return createCompany(
    tenant,
    input,
    (companyId) => [
      tenant.db
        .prepare(
          `INSERT INTO attachments (id, organisation_id, object_type, object_id, r2_key, filename, content_type, size, uploaded_by)
           VALUES (?, ?, 'company', ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newId('att'),
          tenant.organisationId,
          companyId,
          draft.r2Key,
          draft.filename,
          draft.contentType,
          draft.size,
          tenant.userId
        ),
      tenant.db
        .prepare(
          `UPDATE extraction_drafts SET status = 'confirmed', object_id = ?, confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE organisation_id = ? AND id = ? AND status = 'draft'`
        )
        .bind(companyId, tenant.organisationId, draftId),
    ],
    { source: 'laimon', draftId, changedFields }
  );
}

export async function discardDraft(
  tenant: Tenant,
  bucket: R2Bucket,
  draftId: string
): Promise<boolean> {
  const draft = await tenant.db
    .prepare(
      `SELECT r2_key AS r2Key FROM extraction_drafts WHERE organisation_id = ? AND id = ? AND status = 'draft'`
    )
    .bind(tenant.organisationId, draftId)
    .first<{ r2Key: string }>();
  if (!draft) return false;
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE extraction_drafts SET status = 'discarded' WHERE organisation_id = ? AND id = ?`
      )
      .bind(tenant.organisationId, draftId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'laimon.discarded',
      objectType: 'extraction_draft',
      objectId: draftId,
    }),
  ]);
  await bucket.delete(draft.r2Key);
  return true;
}
