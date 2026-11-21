import { beforeEach, describe, expect, it } from 'vitest';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import type { Tenant } from '../tenancy/tenant';
import { companyInput, getCompany, updateCompany } from './companies.server';

describe('companies', () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
    });
    await runSqlFile(db, 'db/reset-demo.sql');
    tenant = {
      db,
      organisationId: 'org_hedgile',
      organisationName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
      userName: null,
      role: 'admin',
    };
  });

  it('seeds Hedgile Limited with the data from the story', async () => {
    expect(await getCompany(tenant, 'co_hedgile_limited')).toMatchObject({
      name: 'Hedgile Limited',
      legalName: 'Hedgile Limited',
      addressLine1: 'Suite 2108, 21/F',
      addressLine2: 'Two Exchange Square, 8 Connaught Place',
      city: 'Central',
      stateProvince: 'Hong Kong',
      country: 'HK',
      contactPerson: 'Ingrid Ingot',
      stockValuationMethod: 'WAVG',
      baseCurrency: 'USD',
    });
  });

  it('cannot change the base currency through the company form', async () => {
    const changed = await updateCompany(
      tenant,
      'co_hedgile_limited',
      companyInput.parse({ name: 'Hedgile Limited', baseCurrency: 'EUR', reportingCurrency: 'eur' })
    );
    expect(changed).toBe(true);
    expect(await getCompany(tenant, 'co_hedgile_limited')).toMatchObject({
      baseCurrency: 'USD',
      reportingCurrency: 'EUR',
    });
  });

  it('refuses an unknown valuation method and an invalid contact email', () => {
    const result = companyInput.safeParse({
      name: 'X',
      stockValuationMethod: 'AVG',
      contactEmail: 'nope',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual([
        'contactEmail',
        'stockValuationMethod',
      ]);
    }
  });
});
