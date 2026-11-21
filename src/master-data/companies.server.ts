import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import type { Tenant } from '../tenancy/tenant.js';

export interface Company {
  id: string;
  name: string;
  country: string | null;
  vatNumber: string | null;
  address: string | null;
}

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const companyInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-Z]{2}$/.test(v), 'Use a two-letter country code, e.g. NL'),
  vatNumber: optionalText,
  address: optionalText,
});
export type CompanyInput = z.infer<typeof companyInput>;

const columns = 'id, name, country, vat_number AS vatNumber, address';

export async function listCompanies(tenant: Tenant): Promise<Company[]> {
  const { results } = await tenant.db
    .prepare(`SELECT ${columns} FROM companies WHERE organisation_id = ? ORDER BY name`)
    .bind(tenant.organisationId)
    .all<Company>();
  return results;
}

export async function getCompany(tenant: Tenant, id: string): Promise<Company | null> {
  return tenant.db
    .prepare(`SELECT ${columns} FROM companies WHERE organisation_id = ? AND id = ?`)
    .bind(tenant.organisationId, id)
    .first<Company>();
}

/** Create a company; extra statements (e.g. an attachment row) run in the same batch. */
export async function createCompany(
  tenant: Tenant,
  input: CompanyInput,
  extra: (id: string) => D1PreparedStatement[] = () => [],
  auditDetails?: Record<string, unknown>
): Promise<string> {
  const id = newId('co');
  await tenant.db.batch([
    tenant.db
      .prepare(
        'INSERT INTO companies (id, organisation_id, name, country, vat_number, address) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, tenant.organisationId, input.name, input.country, input.vatNumber, input.address),
    ...extra(id),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'company.created',
      objectType: 'company',
      objectId: id,
      details: auditDetails,
    }),
  ]);
  return id;
}

/** Returns false when the company does not exist in this organisation. */
export async function updateCompany(
  tenant: Tenant,
  id: string,
  input: CompanyInput
): Promise<boolean> {
  const { results } = await tenant.db
    .prepare(
      `UPDATE companies SET name = ?, country = ?, vat_number = ?, address = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE organisation_id = ? AND id = ? RETURNING id`
    )
    .bind(input.name, input.country, input.vatNumber, input.address, tenant.organisationId, id)
    .all();
  if (results.length === 0) return false;
  await auditStatement(tenant.db, {
    organisationId: tenant.organisationId,
    userId: tenant.userId,
    action: 'company.updated',
    objectType: 'company',
    objectId: id,
  }).run();
  return true;
}
