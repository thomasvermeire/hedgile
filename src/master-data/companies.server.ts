import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import type { Tenant } from '../tenancy/tenant.js';
import { stockValuationMethodOptions, type StockValuationMethod } from './companies.js';

export { stockValuationMethodOptions, type StockValuationMethod };

export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  commercialName: string | null;
  country: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  stateProvince: string | null;
  website: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stockValuationMethod: StockValuationMethod | null;
  /** Locked here; changed only in Settings > Currencies. */
  baseCurrency: string;
  reportingCurrency: string | null;
  address: string | null;
}

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

const optionalShortText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : null));

export const companyInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  legalName: optionalText,
  commercialName: optionalText,
  country: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-Z]{2}$/.test(v), 'Use a two-letter country code, e.g. NL'),
  vatNumber: optionalText,
  registrationNumber: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  postalCode: optionalShortText,
  stateProvince: optionalText,
  website: optionalText,
  contactPerson: optionalText,
  contactEmail: optionalText.refine(
    (v) => v === null || z.email().safeParse(v).success,
    'Enter a valid email address'
  ),
  contactPhone: optionalShortText,
  stockValuationMethod: z
    .enum(stockValuationMethodOptions)
    .optional()
    .transform((v) => (v ? v : null)),
  reportingCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || /^[A-Z]{3}$/.test(v),
      'Use a three-letter currency code, e.g. USD'
    ),
  address: optionalText,
});
export type CompanyInput = z.infer<typeof companyInput>;

const columns = `id, name, legal_name AS legalName, commercial_name AS commercialName, 
  country, vat_number AS vatNumber, registration_number AS registrationNumber,
  address_line_1 AS addressLine1, address_line_2 AS addressLine2, city, postal_code AS postalCode,
  state_province AS stateProvince, website, contact_person AS contactPerson,
  contact_email AS contactEmail, contact_phone AS contactPhone,
  stock_valuation_method AS stockValuationMethod, base_currency AS baseCurrency,
  reporting_currency AS reportingCurrency,
  address`;

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
        `INSERT INTO companies (
          id, organisation_id, name, legal_name, commercial_name, country, 
          vat_number, registration_number, address_line_1, address_line_2, 
          city, postal_code, state_province, website, contact_person, 
          contact_email, contact_phone, stock_valuation_method, reporting_currency, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenant.organisationId,
        input.name,
        input.legalName ?? null,
        input.commercialName ?? null,
        input.country,
        input.vatNumber ?? null,
        input.registrationNumber ?? null,
        input.addressLine1 ?? null,
        input.addressLine2 ?? null,
        input.city ?? null,
        input.postalCode ?? null,
        input.stateProvince ?? null,
        input.website ?? null,
        input.contactPerson ?? null,
        input.contactEmail ?? null,
        input.contactPhone ?? null,
        input.stockValuationMethod ?? null,
        input.reportingCurrency ?? null,
        input.address ?? null
      ),
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
      `UPDATE companies SET 
        name = ?, legal_name = ?, commercial_name = ?, country = ?,
        vat_number = ?, registration_number = ?, address_line_1 = ?, address_line_2 = ?,
        city = ?, postal_code = ?, state_province = ?, website = ?,
        contact_person = ?, contact_email = ?, contact_phone = ?,
        stock_valuation_method = ?, reporting_currency = ?, address = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE organisation_id = ? AND id = ? RETURNING id`
    )
    .bind(
      input.name,
      input.legalName ?? null,
      input.commercialName ?? null,
      input.country,
      input.vatNumber ?? null,
      input.registrationNumber ?? null,
      input.addressLine1 ?? null,
      input.addressLine2 ?? null,
      input.city ?? null,
      input.postalCode ?? null,
      input.stateProvince ?? null,
      input.website ?? null,
      input.contactPerson ?? null,
      input.contactEmail ?? null,
      input.contactPhone ?? null,
      input.stockValuationMethod ?? null,
      input.reportingCurrency ?? null,
      input.address ?? null,
      tenant.organisationId,
      id
    )
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
