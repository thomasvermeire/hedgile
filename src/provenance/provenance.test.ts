import { beforeEach, describe, expect, it } from 'vitest';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import type { Tenant } from '../tenancy/tenant';
import { formatValue, provenanceEntry, renderCalculation } from './provenance';
import { getProvenance, provenanceStatement } from './provenance.server';

function tenantFor(db: D1Database, organisationId: string, userId: string): Tenant {
  return {
    db,
    organisationId,
    organisationName: organisationId,
    userId,
    email: `${userId}@x.test`,
    userName: null,
    role: 'user',
  };
}

describe('recording and reading provenance', () => {
  let db: D1Database;
  let tenant: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, { orgId: 'org_a', orgName: 'A', userId: 'u_a', email: 'a@x.test' });
    tenant = tenantFor(db, 'org_a', 'u_a');
  });

  it('returns null when nothing was recorded', async () => {
    expect(await getProvenance(tenant, 'line', 'l1', 'amount')).toBeNull();
  });

  it('records in the same batch as the write, latest first with history', async () => {
    await db.batch([
      provenanceStatement(tenant, {
        objectType: 'line',
        objectId: 'l1',
        field: 'amount',
        value: 36000,
        trigger: 'manual',
        mode: 'manual',
      }),
    ]);
    await db.batch([
      provenanceStatement(tenant, {
        objectType: 'line',
        objectId: 'l1',
        field: 'amount',
        value: 61500,
        trigger: 'quantity',
        mode: 'automatic',
        formula: 'price × quantity',
        inputs: [
          { name: 'price', value: 12300, source: 'LME Nickel Cash 2026-11-20' },
          { name: 'quantity', value: 5 },
        ],
      }),
    ]);
    const result = await getProvenance(tenant, 'line', 'l1', 'amount');
    expect(result?.latest).toMatchObject({
      value: '61500',
      trigger: 'quantity',
      mode: 'automatic',
      formula: 'price × quantity',
      userId: 'u_a',
      inputs: [
        { name: 'price', value: 12300, source: 'LME Nickel Cash 2026-11-20' },
        { name: 'quantity', value: 5 },
      ],
    });
    expect(result?.latest.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result?.history.map((h) => h.value)).toEqual(['36000']);
    expect(result?.history[0]?.inputs).toBeNull();
  });

  it('rolls the write back together with its provenance', async () => {
    await expect(
      db.batch([
        provenanceStatement(tenant, {
          objectType: 'line',
          objectId: 'l2',
          field: 'amount',
          value: '1',
          trigger: 'manual',
          mode: 'manual',
        }),
        db.prepare('INSERT INTO no_such_table VALUES (1)'),
      ])
    ).rejects.toThrow();
    expect(await getProvenance(tenant, 'line', 'l2', 'amount')).toBeNull();
  });

  it('refuses a bad entry before touching the database', () => {
    expect(() =>
      provenanceStatement(tenant, {
        objectType: 'line',
        objectId: 'l1',
        field: 'amount',
        value: 1,
        trigger: 'weather' as never,
        mode: 'automatic',
      })
    ).toThrow();
  });
});

describe('entry validation', () => {
  const ok = {
    objectType: 'line',
    objectId: 'l1',
    field: 'amount',
    value: 5,
    trigger: 'market',
    mode: 'automatic',
  };

  it('accepts a valid entry and stores the value as text', () => {
    expect(provenanceEntry.parse(ok).value).toBe('5');
  });

  it.each([
    ['unknown trigger', { trigger: 'weather' }],
    ['unknown mode', { mode: 'semi' }],
    ['empty field', { field: ' ' }],
    ['NaN value', { value: Number.NaN }],
    ['manual trigger marked automatic', { trigger: 'manual', mode: 'automatic' }],
    ['inputs without a formula', { inputs: [{ name: 'a', value: 1 }] }],
    ['input without a name', { formula: 'a', inputs: [{ name: '', value: 1 }] }],
  ])('rejects %s', (_label, patch) => {
    expect(provenanceEntry.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});

describe('renderCalculation', () => {
  it('shows the formula with its actual inputs and the result', () => {
    expect(
      renderCalculation(
        'price × quantity',
        [
          { name: 'price', value: 12300 },
          { name: 'quantity', value: 5 },
        ],
        61500
      )
    ).toBe('price × quantity = 12 300 × 5 = 61 500');
  });

  it('matches whole names only, longest first, and never evaluates', () => {
    expect(
      renderCalculation(
        'base_price + premium − 1+1',
        [
          { name: 'base_price', value: 100 },
          { name: 'base', value: 7 },
          { name: 'premium', value: '2.5' },
        ],
        '101.5'
      )
    ).toBe('base_price + premium − 1+1 = 100 + 2.5 − 1+1 = 101.5');
  });

  it('copes with names that look like regular expressions', () => {
    expect(renderCalculation('a.b × (c)', [{ name: 'a.b', value: 2 }], 4)).toBe(
      'a.b × (c) = 2 × (c) = 4'
    );
  });

  it('groups digits', () => {
    expect(formatValue(-1234567.89)).toBe('-1 234 567.89');
    expect(formatValue('abc')).toBe('abc');
    expect(formatValue(999)).toBe('999');
  });
});
