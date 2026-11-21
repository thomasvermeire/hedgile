import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';
import { sourceTypes, type MetalReferenceView, type MetalView } from './markets.js';

export class MetalInUseError extends Error {
  constructor(
    readonly metalName: string,
    readonly reasons: string[]
  ) {
    super(`${metalName} cannot be deleted: ${reasons.join(' ')}`);
    this.name = 'MetalInUseError';
  }
}

/** A symbol, metal name or reference name that the organisation already uses. */
export class DuplicateError extends Error {
  constructor(
    readonly field: 'symbol' | 'name',
    message: string
  ) {
    super(message);
    this.name = 'DuplicateError';
  }
}

export const metalInput = z.object({
  symbol: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{1,3}$/, 'Use the element symbol, one to three letters, e.g. Zn')
    .transform((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()),
  name: z.string().trim().min(1, 'Enter a name').max(100),
});
export type MetalInput = z.infer<typeof metalInput>;

export const metalRenameInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
});

export const referenceInput = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200),
  source: z.string().trim().min(1, 'Enter the publisher, e.g. LME').max(100),
  sourceType: z.enum(sourceTypes, 'Choose Manual, Upload or Connection'),
  active: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === '1' || v === 'true'),
});
export type ReferenceInput = z.infer<typeof referenceInput>;

interface ReferenceRow {
  id: string;
  metalId: string;
  name: string;
  source: string;
  sourceType: MetalReferenceView['sourceType'];
  active: number;
}

const referenceColumns = `id, metal_id AS metalId, name, source, source_type AS sourceType, active`;

function toReference(row: ReferenceRow): MetalReferenceView {
  return { ...row, active: row.active === 1 };
}

/** Every metal of the organisation with its references; book metals first. */
export async function listMetals(tenant: Tenant): Promise<MetalView[]> {
  const [metals, references] = await Promise.all([
    tenant.db
      .prepare(
        `SELECT m.id, m.symbol, m.name,
           EXISTS (SELECT 1 FROM book_metals b WHERE b.organisation_id = m.organisation_id AND b.metal_id = m.id) AS isBook
         FROM metals m WHERE m.organisation_id = ?
         ORDER BY isBook DESC, m.name`
      )
      .bind(tenant.organisationId)
      .all<{ id: string; symbol: string; name: string; isBook: number }>(),
    tenant.db
      .prepare(
        `SELECT ${referenceColumns} FROM metal_references
         WHERE organisation_id = ? AND metal_id IS NOT NULL ORDER BY name`
      )
      .bind(tenant.organisationId)
      .all<ReferenceRow>(),
  ]);
  return metals.results.map((m) => ({
    id: m.id,
    symbol: m.symbol,
    name: m.name,
    isBook: m.isBook === 1,
    references: references.results.filter((r) => r.metalId === m.id).map(toReference),
  }));
}

export async function getMetal(tenant: Tenant, id: string): Promise<MetalView | null> {
  return (await listMetals(tenant)).find((m) => m.id === id) ?? null;
}

export async function getMetalReference(
  tenant: Tenant,
  id: string
): Promise<MetalReferenceView | null> {
  const row = await tenant.db
    .prepare(
      `SELECT ${referenceColumns} FROM metal_references
       WHERE organisation_id = ? AND id = ? AND metal_id IS NOT NULL`
    )
    .bind(tenant.organisationId, id)
    .first<ReferenceRow>();
  return row ? toReference(row) : null;
}

/**
 * Why a metal cannot be deleted; empty when nothing uses it. Later modules
 * (transactions, prices) add their own reasons here.
 */
export async function metalUsage(tenant: Tenant, metalId: string): Promise<string[]> {
  const reasons: string[] = [];
  const book = await tenant.db
    .prepare('SELECT id FROM book_metals WHERE organisation_id = ? AND metal_id = ?')
    .bind(tenant.organisationId, metalId)
    .first();
  if (book) reasons.push('It is a book metal (Settings > Books).');
  const { results } = await tenant.db
    .prepare(
      `SELECT name FROM metal_references
       WHERE organisation_id = ? AND metal_id = ? AND active = 1 ORDER BY name`
    )
    .bind(tenant.organisationId, metalId)
    .all<{ name: string }>();
  if (results.length > 0) {
    reasons.push(
      `It has active ${results.length === 1 ? 'reference' : 'references'}: ${results
        .map((r) => r.name)
        .join(', ')}.`
    );
  }
  return reasons;
}

async function assertMetalFree(
  tenant: Tenant,
  input: { symbol?: string; name?: string },
  exceptId?: string
): Promise<void> {
  const { results } = await tenant.db
    .prepare('SELECT id, symbol, name FROM metals WHERE organisation_id = ?')
    .bind(tenant.organisationId)
    .all<{ id: string; symbol: string; name: string }>();
  for (const m of results) {
    if (m.id === exceptId) continue;
    if (input.symbol && m.symbol.toLowerCase() === input.symbol.toLowerCase()) {
      throw new DuplicateError('symbol', `The symbol ${m.symbol} is already used by ${m.name}`);
    }
    if (input.name && m.name.toLowerCase() === input.name.toLowerCase()) {
      throw new DuplicateError('name', `A metal called ${m.name} already exists`);
    }
  }
}

/** Add a market-only metal (it becomes a book metal in Settings > Books). */
export async function createMetal(tenant: Tenant, input: MetalInput): Promise<string> {
  requireAdmin(tenant);
  await assertMetalFree(tenant, input);
  const id = newId('mtl');
  await tenant.db.batch([
    tenant.db
      .prepare('INSERT INTO metals (id, organisation_id, symbol, name) VALUES (?, ?, ?, ?)')
      .bind(id, tenant.organisationId, input.symbol, input.name),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'metal.created',
      objectType: 'metal',
      objectId: id,
      details: { symbol: input.symbol, name: input.name },
    }),
  ]);
  return id;
}

/** Returns false when the metal is not in this organisation. */
export async function renameMetal(tenant: Tenant, id: string, name: string): Promise<boolean> {
  requireAdmin(tenant);
  const metal = await getMetal(tenant, id);
  if (!metal) return false;
  await assertMetalFree(tenant, { name }, id);
  await tenant.db.batch([
    tenant.db
      .prepare('UPDATE metals SET name = ? WHERE organisation_id = ? AND id = ?')
      .bind(name, tenant.organisationId, id),
    // The menu lists references by metal name.
    tenant.db
      .prepare('UPDATE metal_references SET metal = ? WHERE organisation_id = ? AND metal_id = ?')
      .bind(name, tenant.organisationId, id),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'metal.renamed',
      objectType: 'metal',
      objectId: id,
      details: { from: metal.name, to: name },
    }),
  ]);
  return true;
}

/**
 * Delete a metal and its inactive references. Throws MetalInUseError with the
 * reasons when the metal is in use; returns false when it is not in this organisation.
 */
export async function deleteMetal(tenant: Tenant, id: string): Promise<boolean> {
  requireAdmin(tenant);
  const metal = await getMetal(tenant, id);
  if (!metal) return false;
  const reasons = await metalUsage(tenant, id);
  if (reasons.length > 0) throw new MetalInUseError(metal.name, reasons);
  await tenant.db.batch([
    tenant.db
      .prepare('DELETE FROM metal_references WHERE organisation_id = ? AND metal_id = ?')
      .bind(tenant.organisationId, id),
    tenant.db
      .prepare('DELETE FROM metals WHERE organisation_id = ? AND id = ?')
      .bind(tenant.organisationId, id),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'metal.deleted',
      objectType: 'metal',
      objectId: id,
      details: { symbol: metal.symbol, name: metal.name },
    }),
  ]);
  return true;
}

async function assertReferenceNameFree(
  tenant: Tenant,
  name: string,
  exceptId?: string
): Promise<void> {
  const { results } = await tenant.db
    .prepare('SELECT id FROM metal_references WHERE organisation_id = ? AND lower(name) = lower(?)')
    .bind(tenant.organisationId, name)
    .all<{ id: string }>();
  if (results.some((r) => r.id !== exceptId)) {
    throw new DuplicateError('name', `A reference called ${name} already exists`);
  }
}

/** Returns the new id, or null when the metal is not in this organisation. */
export async function addReference(
  tenant: Tenant,
  metalId: string,
  input: ReferenceInput
): Promise<string | null> {
  requireAdmin(tenant);
  const metal = await getMetal(tenant, metalId);
  if (!metal) return null;
  await assertReferenceNameFree(tenant, input.name);
  const id = newId('ref');
  await tenant.db.batch([
    tenant.db
      .prepare(
        `INSERT INTO metal_references (id, organisation_id, metal, metal_id, name, source, source_type, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenant.organisationId,
        metal.name,
        metalId,
        input.name,
        input.source,
        input.sourceType,
        input.active ? 1 : 0
      ),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'metal_reference.created',
      objectType: 'metal_reference',
      objectId: id,
      details: { metal: metal.name, ...input },
    }),
  ]);
  return id;
}

/** Returns false when the reference is not in this organisation. */
export async function updateReference(
  tenant: Tenant,
  id: string,
  input: ReferenceInput
): Promise<boolean> {
  requireAdmin(tenant);
  const before = await getMetalReference(tenant, id);
  if (!before) return false;
  await assertReferenceNameFree(tenant, input.name, id);
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE metal_references SET name = ?, source = ?, source_type = ?, active = ?
         WHERE organisation_id = ? AND id = ?`
      )
      .bind(
        input.name,
        input.source,
        input.sourceType,
        input.active ? 1 : 0,
        tenant.organisationId,
        id
      ),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'metal_reference.updated',
      objectType: 'metal_reference',
      objectId: id,
      details: {
        from: {
          name: before.name,
          source: before.source,
          sourceType: before.sourceType,
          active: before.active,
        },
        to: input,
      },
    }),
  ]);
  return true;
}
