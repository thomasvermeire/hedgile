import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { listCompanies } from '../master-data/companies.server.js';
import { getOrganisation } from '../settings/members.server.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';
import { currencyCodes } from './currencies.js';

export const reportingCurrencyInput = z.object({
  companyId: z.string().trim().min(1, 'Choose a legal entity'),
  reportingCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(currencyCodes, 'Choose a currency from the list')),
});
export type ReportingCurrencyInput = z.input<typeof reportingCurrencyInput>;

export interface LegalEntityCurrencies {
  id: string;
  name: string;
  /** Locked: set for the organisation, not per entity. */
  baseCurrency: string;
  /** What is stored; null means "follows the base currency". */
  reportingCurrency: string | null;
}

/** The organisation's base currency and one entry per legal entity. */
export async function getCurrencies(
  tenant: Tenant
): Promise<{ baseCurrency: string; entities: LegalEntityCurrencies[] }> {
  const [organisation, companies] = await Promise.all([
    getOrganisation(tenant),
    listCompanies(tenant),
  ]);
  return {
    baseCurrency: organisation.baseCurrency,
    entities: companies.map((c) => ({
      id: c.id,
      name: c.name,
      baseCurrency: c.baseCurrency,
      reportingCurrency: c.reportingCurrency,
    })),
  };
}

/**
 * Set a legal entity's reporting currency (admin only; audited in the same batch).
 * Choosing the entity's own base currency stores NULL, so it keeps following the
 * base currency and shows as "USD (default)". Returns false when the company is
 * not in this organisation. The base currency is never changed here.
 */
export async function setReportingCurrency(
  tenant: Tenant,
  input: ReportingCurrencyInput
): Promise<boolean> {
  requireAdmin(tenant);
  const parsed = reportingCurrencyInput.parse(input);
  const company = await tenant.db
    .prepare(
      'SELECT base_currency AS baseCurrency, reporting_currency AS reportingCurrency FROM companies WHERE organisation_id = ? AND id = ?'
    )
    .bind(tenant.organisationId, parsed.companyId)
    .first<{ baseCurrency: string; reportingCurrency: string | null }>();
  if (!company) return false;
  const stored =
    parsed.reportingCurrency === company.baseCurrency ? null : parsed.reportingCurrency;
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE companies SET reporting_currency = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE organisation_id = ? AND id = ?`
      )
      .bind(stored, tenant.organisationId, parsed.companyId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'company.reporting_currency_set',
      objectType: 'company',
      objectId: parsed.companyId,
      details: { from: company.reportingCurrency, to: stored },
    }),
  ]);
  return true;
}
