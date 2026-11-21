import { describe, expect, it } from 'vitest';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import type { Tenant } from '../tenancy/tenant';
import { listCompanyValuations } from './valuation.server';

const tenantFor = (db: D1Database, organisationId: string): Tenant => ({
  db,
  organisationId,
  organisationName: organisationId,
  userId: 'u1',
  email: 'a@x.test',
  userName: null,
  role: 'admin',
});

describe('listCompanyValuations', () => {
  it('lists Hedgile Limited with WAVG, and nothing for another organisation', async () => {
    const db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
    });
    await runSqlFile(db, 'db/reset-demo.sql');
    const mine = await listCompanyValuations(tenantFor(db, 'org_hedgile'));
    expect(mine).toContainEqual(
      expect.objectContaining({ name: 'Hedgile Limited', method: 'WAVG' })
    );
    expect(await listCompanyValuations(tenantFor(db, 'org_other'))).toEqual([]);
  });
});
