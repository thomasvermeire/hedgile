import { beforeEach, describe, expect, it } from 'vitest';
import { listActiveReferences } from '../master-data/references.server';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import {
  addReference,
  createMetal,
  deleteMetal,
  DuplicateError,
  getMetal,
  listMetals,
  MetalInUseError,
  metalInput,
  metalRenameInput,
  metalUsage,
  referenceInput,
  renameMetal,
  updateReference,
} from './markets.server';

describe('markets', () => {
  let db: D1Database;
  let tenant: Tenant;
  let reader: Tenant;

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
    reader = { ...tenant, role: 'user' };
  });

  async function auditActions(): Promise<string[]> {
    const { results } = await db
      .prepare("SELECT action FROM audit_log WHERE action LIKE 'metal%' ORDER BY rowid")
      .all<{ action: string }>();
    return results.map((r) => r.action);
  }

  it('lists the book metals with the two seeded references and their sources', async () => {
    const metals = await listMetals(tenant);
    expect(metals.map((m) => [m.symbol, m.name, m.isBook])).toEqual([
      ['Co', 'Cobalt', true],
      ['Ni', 'Nickel', true],
    ]);
    const refs = metals.flatMap((m) => m.references);
    expect(refs.map((r) => [r.name, r.source, r.sourceType, r.active])).toEqual([
      ['Metal Bulletin Low Grade Low (MBLL)', 'MB', 'upload', true],
      ['LME Nickel Cash Settlement', 'LME', 'upload', true],
    ]);
    expect(metals.find((m) => m.symbol === 'Co')?.references[0]?.name).toBe(
      'Metal Bulletin Low Grade Low (MBLL)'
    );
  });

  it('adds a market-only metal, shown after the book metals', async () => {
    const id = await createMetal(tenant, metalInput.parse({ symbol: 'zN', name: ' Zinc ' }));
    const metals = await listMetals(tenant);
    expect(metals.map((m) => m.symbol)).toEqual(['Co', 'Ni', 'Zn']);
    expect(await getMetal(tenant, id)).toMatchObject({ symbol: 'Zn', name: 'Zinc', isBook: false });
    expect(await auditActions()).toEqual(['metal.created']);
  });

  it('refuses a symbol or name that the organisation already has', async () => {
    await expect(
      createMetal(tenant, metalInput.parse({ symbol: 'NI', name: 'Something' }))
    ).rejects.toThrow(DuplicateError);
    await expect(
      createMetal(tenant, metalInput.parse({ symbol: 'Zn', name: 'nickel' }))
    ).rejects.toThrow(DuplicateError);
    expect(await listMetals(tenant)).toHaveLength(2);
  });

  it('validates the input', () => {
    expect(metalInput.safeParse({ symbol: '', name: 'Zinc' }).success).toBe(false);
    expect(metalInput.safeParse({ symbol: 'Zinc', name: 'Zinc' }).success).toBe(false);
    expect(metalInput.safeParse({ symbol: 'Z1', name: 'Zinc' }).success).toBe(false);
    expect(metalInput.safeParse({ symbol: 'Zn', name: '  ' }).success).toBe(false);
    expect(metalRenameInput.safeParse({ name: '' }).success).toBe(false);
    expect(referenceInput.safeParse({ name: 'X', source: 'LME', sourceType: 'fax' }).success).toBe(
      false
    );
    expect(referenceInput.safeParse({ name: 'X', source: '', sourceType: 'manual' }).success).toBe(
      false
    );
    expect(
      referenceInput.parse({ name: 'X', source: 'LME', sourceType: 'manual', active: 'on' }).active
    ).toBe(true);
    expect(referenceInput.parse({ name: 'X', source: 'LME', sourceType: 'manual' }).active).toBe(
      false
    );
  });

  it('renames a metal, and the menu follows', async () => {
    expect(await renameMetal(tenant, 'mtl_ni', 'Nickel (Class 1)')).toBe(true);
    expect((await getMetal(tenant, 'mtl_ni'))?.name).toBe('Nickel (Class 1)');
    const active = await listActiveReferences(tenant);
    expect(active.find((r) => r.id === 'ref_lme_ni_cash')?.metal).toBe('Nickel (Class 1)');
    expect(await auditActions()).toEqual(['metal.renamed']);
  });

  it('deletes a market-only metal without references', async () => {
    const id = await createMetal(tenant, metalInput.parse({ symbol: 'Zn', name: 'Zinc' }));
    expect(await metalUsage(tenant, id)).toEqual([]);
    expect(await deleteMetal(tenant, id)).toBe(true);
    expect(await getMetal(tenant, id)).toBeNull();
    expect(await auditActions()).toEqual(['metal.created', 'metal.deleted']);
  });

  it('refuses to delete a book metal, with the reason', async () => {
    const error = await deleteMetal(tenant, 'mtl_co').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetalInUseError);
    expect((error as MetalInUseError).reasons).toContain('It is a book metal (Settings > Books).');
    expect((error as Error).message).toContain('Cobalt cannot be deleted');
    expect(await getMetal(tenant, 'mtl_co')).not.toBeNull();
  });

  it('refuses to delete a market-only metal that has active references', async () => {
    const id = await createMetal(tenant, metalInput.parse({ symbol: 'Zn', name: 'Zinc' }));
    await addReference(
      tenant,
      id,
      referenceInput.parse({
        name: 'LME Zinc Cash',
        source: 'LME',
        sourceType: 'connection',
        active: 'on',
      })
    );
    expect(await metalUsage(tenant, id)).toEqual(['It has active reference: LME Zinc Cash.']);
    await expect(deleteMetal(tenant, id)).rejects.toThrow(
      'Zinc cannot be deleted: It has active reference: LME Zinc Cash.'
    );
    expect(await getMetal(tenant, id)).not.toBeNull();
  });

  it('deletes a metal whose references are all inactive, together with them', async () => {
    const id = await createMetal(tenant, metalInput.parse({ symbol: 'Zn', name: 'Zinc' }));
    await addReference(
      tenant,
      id,
      referenceInput.parse({ name: 'Old Zinc', source: 'LME', sourceType: 'manual' })
    );
    expect(await deleteMetal(tenant, id)).toBe(true);
    const row = await db.prepare("SELECT id FROM metal_references WHERE name = 'Old Zinc'").first();
    expect(row).toBeNull();
  });

  it('adds and edits a reference with name, publisher, source and active', async () => {
    const refId = await addReference(
      tenant,
      'mtl_ni',
      referenceInput.parse({
        name: 'Fastmarkets Nickel',
        source: 'Fastmarkets',
        sourceType: 'manual',
        active: 'on',
      })
    );
    expect(refId).not.toBeNull();
    expect(
      (await getMetal(tenant, 'mtl_ni'))?.references.find((r) => r.id === refId)
    ).toMatchObject({ source: 'Fastmarkets', sourceType: 'manual', active: true });
    expect(
      await updateReference(
        tenant,
        refId ?? '',
        referenceInput.parse({
          name: 'Fastmarkets Nickel',
          source: 'FM',
          sourceType: 'connection',
        })
      )
    ).toBe(true);
    expect(
      (await getMetal(tenant, 'mtl_ni'))?.references.find((r) => r.id === refId)
    ).toMatchObject({ source: 'FM', sourceType: 'connection', active: false });
    expect((await listActiveReferences(tenant)).some((r) => r.id === refId)).toBe(false);
    expect(await auditActions()).toEqual(['metal_reference.created', 'metal_reference.updated']);
  });

  it('refuses a reference name that is already used', async () => {
    await expect(
      addReference(
        tenant,
        'mtl_ni',
        referenceInput.parse({
          name: 'lme nickel cash settlement',
          source: 'LME',
          sourceType: 'upload',
        })
      )
    ).rejects.toThrow(DuplicateError);
  });

  it('lets only an admin change anything', async () => {
    const ref = referenceInput.parse({ name: 'X', source: 'Y', sourceType: 'manual' });
    await expect(
      createMetal(reader, metalInput.parse({ symbol: 'Zn', name: 'Zinc' }))
    ).rejects.toThrow(ForbiddenError);
    await expect(renameMetal(reader, 'mtl_ni', 'Nope')).rejects.toThrow(ForbiddenError);
    await expect(deleteMetal(reader, 'mtl_ni')).rejects.toThrow(ForbiddenError);
    await expect(addReference(reader, 'mtl_ni', ref)).rejects.toThrow(ForbiddenError);
    await expect(updateReference(reader, 'ref_lme_ni_cash', ref)).rejects.toThrow(ForbiddenError);
    expect((await getMetal(reader, 'mtl_ni'))?.name).toBe('Nickel');
    expect(await listMetals(reader)).toHaveLength(2);
    expect(await auditActions()).toEqual([]);
  });
});
