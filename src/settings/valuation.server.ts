import { listCompanies } from '../master-data/companies.server.js';
import type { StockValuationMethod } from '../master-data/companies.js';
import type { Tenant } from '../tenancy/tenant.js';

export interface CompanyValuation {
  id: string;
  name: string;
  method: StockValuationMethod | null;
}

/** The stock valuation method of each legal entity of the organisation (read-only). */
export async function listCompanyValuations(tenant: Tenant): Promise<CompanyValuation[]> {
  const companies = await listCompanies(tenant);
  return companies.map((c) => ({ id: c.id, name: c.name, method: c.stockValuationMethod }));
}
