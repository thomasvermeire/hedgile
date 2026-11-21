import { beforeEach, describe, expect, it } from 'vitest';
import { getCompany } from '../master-data/companies.server';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import { ForbiddenError, type Role, type Tenant } from '../tenancy/tenant';
import { effectiveReportingCurrency } from './currencies';
import { getCurrencies, setReportingCurrency } from './currencies.server';

describe('currencies', () => {
  let db: D1Database;

  function tenant(role: Role = 'admin'): Tenant {
    return {
      db,
      organisationId: 'org_hedgile',
      organisationName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
      userName: null,
      role,
    };
  }

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
    });
    await runSqlFile(db, 'db/reset-demo.sql');
  });

  it('shows Hedgile Limited with USD base and USD (default) reporting', async () => {
    const { baseCurrency, entities } = await getCurrencies(tenant());
    expect(baseCurrency).toBe('USD');
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ name: 'Hedgile Limited', baseCurrency: 'USD' });
    expect(effectiveReportingCurrency(entities[0]!)).toEqual({ code: 'USD', isDefault: true });
  });

  it('a reporting currency changed here shows on the company', async () => {
    expect(
      await setReportingCurrency(tenant(), {
        companyId: 'co_hedgile_limited',
        reportingCurrency: 'eur',
      })
    ).toBe(true);
    const company = await getCompany(tenant(), 'co_hedgile_limited');
    expect(company).toMatchObject({ baseCurrency: 'USD', reportingCurrency: 'EUR' });
    expect(effectiveReportingCurrency(company!)).toEqual({ code: 'EUR', isDefault: false });
    const audit = await db
      .prepare("SELECT details FROM audit_log WHERE action = 'company.reporting_currency_set'")
      .all<{ details: string }>();
    expect(audit.results.map((r) => JSON.parse(r.details))).toEqual([{ from: null, to: 'EUR' }]);
  });

  it('choosing the base currency goes back to following it', async () => {
    await setReportingCurrency(tenant(), {
      companyId: 'co_hedgile_limited',
      reportingCurrency: 'EUR',
    });
    await setReportingCurrency(tenant(), {
      companyId: 'co_hedgile_limited',
      reportingCurrency: 'USD',
    });
    const company = await getCompany(tenant(), 'co_hedgile_limited');
    expect(company?.reportingCurrency).toBeNull();
    expect(effectiveReportingCurrency(company!).isDefault).toBe(true);
  });

  it('refuses a code that is not in the list', async () => {
    for (const reportingCurrency of ['XYZ', 'US', '', 'DOLLAR']) {
      await expect(
        setReportingCurrency(tenant(), { companyId: 'co_hedgile_limited', reportingCurrency })
      ).rejects.toThrow();
    }
    expect((await getCompany(tenant(), 'co_hedgile_limited'))?.reportingCurrency).toBeNull();
  });

  it('is for admins only', async () => {
    await expect(
      setReportingCurrency(tenant('user'), {
        companyId: 'co_hedgile_limited',
        reportingCurrency: 'EUR',
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getCompany(tenant(), 'co_hedgile_limited'))?.reportingCurrency).toBeNull();
  });

  it('never changes the base currency, and an unknown company is not found', async () => {
    await setReportingCurrency(tenant(), {
      companyId: 'co_hedgile_limited',
      reportingCurrency: 'JPY',
    });
    expect((await getCompany(tenant(), 'co_hedgile_limited'))?.baseCurrency).toBe('USD');
    expect((await getCurrencies(tenant())).baseCurrency).toBe('USD');
    expect(
      await setReportingCurrency(tenant(), { companyId: 'co_nope', reportingCurrency: 'EUR' })
    ).toBe(false);
  });
});
