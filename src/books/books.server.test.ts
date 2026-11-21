import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import {
  activateMetal,
  addPeriod,
  BooksError,
  listBookMetals,
  setBaseUnits,
  updatePeriod,
} from './books.server';

const NOW = new Date('2026-11-21T10:00:00Z');

describe('books', () => {
  let db: D1Database;
  let admin: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
    });
    await runSqlFile(db, 'db/reset-demo.sql');
    admin = {
      db,
      organisationId: 'org_hedgile',
      organisationName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
      userName: null,
      role: 'admin',
    };
  });

  async function actions(): Promise<string[]> {
    const { results } = await db
      .prepare("SELECT action FROM audit_log WHERE action LIKE 'book_metal.%' ORDER BY rowid")
      .all<{ action: string }>();
    return results.map((r) => r.action);
  }

  it('is seeded with Ni and Co, kg, USD, active from 2018-12-01 and open-ended', async () => {
    const metals = await listBookMetals(admin, NOW);
    expect(metals.map((m) => [m.symbol, m.baseUom, m.baseCurrency, m.activeToday])).toEqual([
      ['Co', 'kg', 'USD', true],
      ['Ni', 'kg', 'USD', true],
    ]);
    for (const m of metals) {
      expect(m.periods).toEqual([
        expect.objectContaining({ status: 'active', validFrom: '2018-12-01', validTo: null }),
      ]);
    }
  });

  it('activating a metal creates the metal, the book metal and a period from today', async () => {
    const id = await activateMetal(admin, 'Cu', NOW);
    const copper = (await listBookMetals(admin, NOW)).find((m) => m.id === id);
    expect(copper).toMatchObject({
      symbol: 'Cu',
      name: 'Copper',
      baseUom: 'kg',
      baseCurrency: 'USD',
      activeToday: true,
      periods: [{ status: 'active', validFrom: '2026-11-21', validTo: null }],
    });
    expect(await actions()).toEqual(['book_metal.activated']);
  });

  it("uses the organisation's base currency for a new book metal", async () => {
    await db
      .prepare("UPDATE organisations SET base_currency = 'EUR' WHERE id = 'org_hedgile'")
      .run();
    await activateMetal(admin, 'Zn', NOW);
    expect((await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Zn')?.baseCurrency).toBe(
      'EUR'
    );
  });

  it('reuses an existing metal row (market-only metal) when activating', async () => {
    await db
      .prepare(
        "INSERT INTO metals (id, organisation_id, symbol, name) VALUES ('mtl_zn', 'org_hedgile', 'Zn', 'Zinc')"
      )
      .run();
    await activateMetal(admin, 'Zn', NOW);
    const { results } = await db
      .prepare("SELECT id FROM metals WHERE organisation_id = 'org_hedgile' AND symbol = 'Zn'")
      .all();
    expect(results).toHaveLength(1);
    expect((await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Zn')?.metalId).toBe(
      'mtl_zn'
    );
  });

  it('refuses a non-metal, metalloid or unknown symbol on the server', async () => {
    for (const symbol of ['O', 'C', 'Si', 'Ge', 'Xx', '']) {
      await expect(activateMetal(admin, symbol, NOW)).rejects.toBeInstanceOf(BooksError);
    }
    expect(await listBookMetals(admin, NOW)).toHaveLength(2);
    expect(await actions()).toEqual([]);
  });

  it('refuses to activate a metal that is already active', async () => {
    await expect(activateMetal(admin, 'Ni', NOW)).rejects.toBeInstanceOf(BooksError);
    expect((await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni')?.periods).toHaveLength(
      1
    );
  });

  it('reactivates a metal whose periods have all ended with a new period from today', async () => {
    const ni = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    await updatePeriod(
      admin,
      ni?.periods[0]?.id ?? '',
      { status: 'active', validFrom: '2018-12-01', validTo: '2026-06-30' },
      NOW
    );
    await activateMetal(admin, 'Ni', NOW);
    const after = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    expect(after?.periods.map((p) => p.validFrom)).toEqual(['2018-12-01', '2026-11-21']);
    expect(after?.activeToday).toBe(true);
  });

  it('a past period cannot change status, and nothing is written or audited', async () => {
    const ni = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    const periodId = ni?.periods[0]?.id ?? '';
    await updatePeriod(
      admin,
      periodId,
      { status: 'active', validFrom: '2018-12-01', validTo: '2026-06-30' },
      NOW
    );
    await expect(
      updatePeriod(
        admin,
        periodId,
        { status: 'inactive', validFrom: '2018-12-01', validTo: '2026-06-30' },
        NOW
      )
    ).rejects.toMatchObject({ field: 'status' });
    const after = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    expect(after?.periods[0]?.status).toBe('active');
    expect(await actions()).toEqual(['book_metal.period_changed']);
  });

  it('a current period can be switched to inactive, which deactivates the metal today', async () => {
    const co = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Co');
    await updatePeriod(
      admin,
      co?.periods[0]?.id ?? '',
      { status: 'inactive', validFrom: '2018-12-01', validTo: null },
      NOW
    );
    expect((await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Co')?.activeToday).toBe(
      false
    );
  });

  it('adds a period with the default dates and refuses an overlapping one', async () => {
    const ni = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    await expect(
      addPeriod(
        admin,
        ni?.id ?? '',
        { status: 'active', validFrom: '2026-11-21', validTo: null },
        NOW
      )
    ).rejects.toMatchObject({ field: 'validFrom' });
    await updatePeriod(
      admin,
      ni?.periods[0]?.id ?? '',
      { status: 'active', validFrom: '2018-12-01', validTo: '2027-01-31' },
      NOW
    );
    expect(
      await addPeriod(
        admin,
        ni?.id ?? '',
        { status: 'inactive', validFrom: '2027-02-01', validTo: null },
        NOW
      )
    ).toBe(true);
    const periods = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni')?.periods;
    expect(periods?.map((p) => [p.status, p.validFrom, p.validTo])).toEqual([
      ['active', '2018-12-01', '2027-01-31'],
      ['inactive', '2027-02-01', null],
    ]);
  });

  it('sets base UoM and currency from the standard lists only', async () => {
    const ni = (await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni');
    expect(await setBaseUnits(admin, ni?.id ?? '', { baseUom: 'mt', baseCurrency: 'EUR' })).toBe(
      true
    );
    expect((await listBookMetals(admin, NOW)).find((m) => m.symbol === 'Ni')).toMatchObject({
      baseUom: 'mt',
      baseCurrency: 'EUR',
    });
    expect(await actions()).toEqual(['book_metal.units_changed']);
  });

  it('only an admin can change books', async () => {
    const user: Tenant = { ...admin, role: 'user' };
    const ni = (await listBookMetals(user, NOW)).find((m) => m.symbol === 'Ni');
    await expect(activateMetal(user, 'Cu', NOW)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setBaseUnits(user, ni?.id ?? '', { baseUom: 'mt', baseCurrency: 'EUR' })
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      addPeriod(
        user,
        ni?.id ?? '',
        { status: 'active', validFrom: '2030-01-01', validTo: null },
        NOW
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updatePeriod(
        user,
        ni?.periods[0]?.id ?? '',
        { status: 'inactive', validFrom: '2018-12-01', validTo: null },
        NOW
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await listBookMetals(user, NOW)).toHaveLength(2);
    expect(await actions()).toEqual([]);
  });
});
