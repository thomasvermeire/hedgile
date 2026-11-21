import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { today as todayUtc } from '../posting/dates.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';
import { findElement } from './elements.js';
import { currencyCodes, defaultUom, uomValues } from './lists.js';
import {
  checkPeriod,
  defaultPeriod,
  isActiveOn,
  type Period,
  type PeriodDraft,
  type PeriodProblem,
} from './periods.js';

export interface BookMetal {
  id: string;
  metalId: string;
  symbol: string;
  name: string;
  baseUom: string;
  baseCurrency: string;
  periods: Period[];
  /** Active on the day the list was read. */
  activeToday: boolean;
}

/** A rule of the Books settings was broken; `field` names the form field when there is one. */
export class BooksError extends Error {
  constructor(
    message: string,
    readonly field: string = 'form'
  ) {
    super(message);
    this.name = 'BooksError';
  }
}

function fail(problem: PeriodProblem): never {
  throw new BooksError(problem.message, problem.field);
}

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const periodInput = z.object({
  status: z.enum(['active', 'inactive'], 'Choose active or inactive'),
  validFrom: z.string().trim().min(1, 'Enter a start date'),
  validTo: optionalDate,
});

export const unitsInput = z.object({
  baseUom: z.enum(uomValues as [string, ...string[]], 'Choose a unit of measure'),
  baseCurrency: z.enum(currencyCodes as [string, ...string[]], 'Choose a currency'),
});
export type UnitsInput = z.infer<typeof unitsInput>;

interface BookMetalRow {
  id: string;
  metalId: string;
  symbol: string;
  name: string;
  baseUom: string;
  baseCurrency: string;
}

interface PeriodRow extends Period {
  bookMetalId: string;
}

/** The organisation's book metals with their periods, ordered by atomic number. */
export async function listBookMetals(tenant: Tenant, now: Date = new Date()): Promise<BookMetal[]> {
  const date = todayUtc(now);
  const [metals, periods] = await Promise.all([
    tenant.db
      .prepare(
        `SELECT b.id, b.metal_id AS metalId, m.symbol, m.name,
                b.base_uom AS baseUom, b.base_currency AS baseCurrency
         FROM book_metals b JOIN metals m ON m.id = b.metal_id AND m.organisation_id = b.organisation_id
         WHERE b.organisation_id = ?`
      )
      .bind(tenant.organisationId)
      .all<BookMetalRow>(),
    tenant.db
      .prepare(
        `SELECT id, book_metal_id AS bookMetalId, status, valid_from AS validFrom, valid_to AS validTo
         FROM book_metal_periods WHERE organisation_id = ? ORDER BY valid_from, id`
      )
      .bind(tenant.organisationId)
      .all<PeriodRow>(),
  ]);
  return metals.results
    .map((m) => {
      const own = periods.results
        .filter((p) => p.bookMetalId === m.id)
        .map(({ id, status, validFrom, validTo }) => ({ id, status, validFrom, validTo }));
      return { ...m, periods: own, activeToday: isActiveOn(own, date) };
    })
    .sort(
      (a, b) =>
        (findElement(a.symbol)?.number ?? 999) - (findElement(b.symbol)?.number ?? 999) ||
        a.symbol.localeCompare(b.symbol)
    );
}

async function getBookMetal(tenant: Tenant, id: string): Promise<BookMetalRow | null> {
  return tenant.db
    .prepare(
      `SELECT b.id, b.metal_id AS metalId, m.symbol, m.name,
              b.base_uom AS baseUom, b.base_currency AS baseCurrency
       FROM book_metals b JOIN metals m ON m.id = b.metal_id AND m.organisation_id = b.organisation_id
       WHERE b.organisation_id = ? AND b.id = ?`
    )
    .bind(tenant.organisationId, id)
    .first<BookMetalRow>();
}

async function periodsOf(tenant: Tenant, bookMetalId: string): Promise<Period[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT id, status, valid_from AS validFrom, valid_to AS validTo
       FROM book_metal_periods WHERE organisation_id = ? AND book_metal_id = ?
       ORDER BY valid_from, id`
    )
    .bind(tenant.organisationId, bookMetalId)
    .all<Period>();
  return results;
}

/**
 * Activate a metal from the periodic table: creates the metal if the organisation has none yet,
 * its book metal (kg, the organisation's base currency) and an active period from today, open-ended.
 * Returns the book metal id.
 */
export async function activateMetal(
  tenant: Tenant,
  symbol: string,
  now: Date = new Date()
): Promise<string> {
  requireAdmin(tenant);
  const element = findElement(symbol);
  if (!element) throw new BooksError('Unknown element', 'symbol');
  if (!element.isMetal) throw new BooksError(`${element.name} is not a metal`, 'symbol');
  const date = todayUtc(now);

  const metal = await tenant.db
    .prepare('SELECT id FROM metals WHERE organisation_id = ? AND symbol = ?')
    .bind(tenant.organisationId, element.symbol)
    .first<{ id: string }>();
  const existing = metal
    ? await tenant.db
        .prepare('SELECT id FROM book_metals WHERE organisation_id = ? AND metal_id = ?')
        .bind(tenant.organisationId, metal.id)
        .first<{ id: string }>()
    : null;

  const period = defaultPeriod(date);
  if (existing) {
    const problem = checkPeriod(period, await periodsOf(tenant, existing.id), date);
    if (problem) {
      throw new BooksError(
        `${element.name} already has a period covering today or later; edit its periods instead`,
        'symbol'
      );
    }
  }

  const org = await tenant.db
    .prepare('SELECT base_currency AS baseCurrency FROM organisations WHERE id = ?')
    .bind(tenant.organisationId)
    .first<{ baseCurrency: string }>();
  const metalId = metal?.id ?? newId('mtl');
  const bookMetalId = existing?.id ?? newId('bkm');
  const periodId = newId('bkp');
  const statements: D1PreparedStatement[] = [];
  if (!metal) {
    statements.push(
      tenant.db
        .prepare('INSERT INTO metals (id, organisation_id, symbol, name) VALUES (?, ?, ?, ?)')
        .bind(metalId, tenant.organisationId, element.symbol, element.name)
    );
  }
  if (!existing) {
    statements.push(
      tenant.db
        .prepare(
          'INSERT INTO book_metals (id, organisation_id, metal_id, base_uom, base_currency) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(bookMetalId, tenant.organisationId, metalId, defaultUom, org?.baseCurrency ?? 'USD')
    );
  }
  statements.push(
    tenant.db
      .prepare(
        `INSERT INTO book_metal_periods (id, organisation_id, book_metal_id, status, valid_from, valid_to)
         VALUES (?, ?, ?, 'active', ?, NULL)`
      )
      .bind(periodId, tenant.organisationId, bookMetalId, date),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'book_metal.activated',
      objectType: 'book_metal',
      objectId: bookMetalId,
      details: { symbol: element.symbol, periodId, validFrom: date },
    })
  );
  await tenant.db.batch(statements);
  return bookMetalId;
}

/** Change the base UoM and currency of a book metal. False when it is not in this organisation. */
export async function setBaseUnits(
  tenant: Tenant,
  bookMetalId: string,
  input: UnitsInput
): Promise<boolean> {
  requireAdmin(tenant);
  const current = await getBookMetal(tenant, bookMetalId);
  if (!current) return false;
  await tenant.db.batch([
    tenant.db
      .prepare(
        'UPDATE book_metals SET base_uom = ?, base_currency = ? WHERE organisation_id = ? AND id = ?'
      )
      .bind(input.baseUom, input.baseCurrency, tenant.organisationId, bookMetalId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'book_metal.units_changed',
      objectType: 'book_metal',
      objectId: bookMetalId,
      details: {
        symbol: current.symbol,
        from: { baseUom: current.baseUom, baseCurrency: current.baseCurrency },
        to: input,
      },
    }),
  ]);
  return true;
}

/** Add a period to a book metal. False when the book metal is not in this organisation. */
export async function addPeriod(
  tenant: Tenant,
  bookMetalId: string,
  draft: PeriodDraft,
  now: Date = new Date()
): Promise<boolean> {
  requireAdmin(tenant);
  const metal = await getBookMetal(tenant, bookMetalId);
  if (!metal) return false;
  const problem = checkPeriod(draft, await periodsOf(tenant, bookMetalId), todayUtc(now));
  if (problem) fail(problem);
  const id = newId('bkp');
  await tenant.db.batch([
    tenant.db
      .prepare(
        `INSERT INTO book_metal_periods (id, organisation_id, book_metal_id, status, valid_from, valid_to)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, tenant.organisationId, bookMetalId, draft.status, draft.validFrom, draft.validTo),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'book_metal.period_added',
      objectType: 'book_metal',
      objectId: bookMetalId,
      details: { symbol: metal.symbol, periodId: id, ...draft },
    }),
  ]);
  return true;
}

/** Change a period. False when it is not in this organisation. A past period keeps its status. */
export async function updatePeriod(
  tenant: Tenant,
  periodId: string,
  draft: PeriodDraft,
  now: Date = new Date()
): Promise<boolean> {
  requireAdmin(tenant);
  const row = await tenant.db
    .prepare(
      `SELECT id, book_metal_id AS bookMetalId, status, valid_from AS validFrom, valid_to AS validTo
       FROM book_metal_periods WHERE organisation_id = ? AND id = ?`
    )
    .bind(tenant.organisationId, periodId)
    .first<PeriodRow>();
  if (!row) return false;
  const existing: Period = {
    id: row.id,
    status: row.status,
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
  const others = (await periodsOf(tenant, row.bookMetalId)).filter((p) => p.id !== periodId);
  const problem = checkPeriod(draft, others, todayUtc(now), existing);
  if (problem) fail(problem);
  await tenant.db.batch([
    tenant.db
      .prepare(
        `UPDATE book_metal_periods SET status = ?, valid_from = ?, valid_to = ?
         WHERE organisation_id = ? AND id = ?`
      )
      .bind(draft.status, draft.validFrom, draft.validTo, tenant.organisationId, periodId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'book_metal.period_changed',
      objectType: 'book_metal',
      objectId: row.bookMetalId,
      details: {
        periodId,
        from: { status: existing.status, validFrom: existing.validFrom, validTo: existing.validTo },
        to: draft,
      },
    }),
  ]);
  return true;
}
