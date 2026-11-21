import { z } from 'zod';
import { auditStatement } from '../db/audit.js';
import { newId } from '../db/ids.js';
import { requireAdmin, type Tenant } from '../tenancy/tenant.js';
import { isIsoDate } from '../posting/dates.js';
import { parseWeekdays, type PublicationCalendar } from './publication-days.js';

export interface Holiday {
  date: string;
  name: string | null;
}

export interface ReferenceCalendar extends PublicationCalendar {
  referenceId: string;
  referenceName: string;
  metal: string;
  weekdays: number[];
  holidays: string[];
  /** The holidays with their names, ascending by date. */
  holidayList: Holiday[];
}

export class HolidayExistsError extends Error {
  constructor() {
    super('This date is already a holiday');
    this.name = 'HolidayExistsError';
  }
}

export const weekdaysInput = z.object({
  weekdays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, 'Choose at least one weekday')
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
});

export const holidayInput = z.object({
  date: z.string().trim().refine(isIsoDate, 'Enter a valid date (YYYY-MM-DD)'),
  name: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
});
export type HolidayInput = z.infer<typeof holidayInput>;

interface CalendarRow {
  referenceId: string;
  referenceName: string;
  metal: string;
  weekdays: string | null;
}

const calendarSelect = `SELECT r.id AS referenceId, r.name AS referenceName, r.metal AS metal,
         c.weekdays AS weekdays
       FROM metal_references r
       LEFT JOIN publication_calendars c
         ON c.metal_reference_id = r.id AND c.organisation_id = r.organisation_id
       WHERE r.organisation_id = ?`;

async function withHolidays(tenant: Tenant, rows: CalendarRow[]): Promise<ReferenceCalendar[]> {
  const { results } = await tenant.db
    .prepare(
      `SELECT c.metal_reference_id AS referenceId, h.date AS date, h.name AS name
         FROM publication_holidays h
         JOIN publication_calendars c ON c.id = h.calendar_id AND c.organisation_id = h.organisation_id
        WHERE h.organisation_id = ?
        ORDER BY h.date`
    )
    .bind(tenant.organisationId)
    .all<Holiday & { referenceId: string }>();
  return rows.map((row) => {
    const holidayList = results
      .filter((h) => h.referenceId === row.referenceId)
      .map(({ date, name }) => ({ date, name }));
    return {
      referenceId: row.referenceId,
      referenceName: row.referenceName,
      metal: row.metal,
      weekdays: row.weekdays ? parseWeekdays(row.weekdays) : [],
      holidays: holidayList.map((h) => h.date),
      holidayList,
    };
  });
}

/** The calendar of every active metal reference of the organisation (empty until one is set). */
export async function listCalendars(tenant: Tenant): Promise<ReferenceCalendar[]> {
  const { results } = await tenant.db
    .prepare(`${calendarSelect} AND r.active = 1 ORDER BY r.metal, r.name`)
    .bind(tenant.organisationId)
    .all<CalendarRow>();
  return withHolidays(tenant, results);
}

/** One reference's calendar; null when the reference is not in this organisation. */
export async function getCalendar(
  tenant: Tenant,
  referenceId: string
): Promise<ReferenceCalendar | null> {
  const row = await tenant.db
    .prepare(`${calendarSelect} AND r.id = ?`)
    .bind(tenant.organisationId, referenceId)
    .first<CalendarRow>();
  if (!row) return null;
  const [calendar] = await withHolidays(tenant, [row]);
  return calendar ?? null;
}

async function referenceExists(tenant: Tenant, referenceId: string): Promise<boolean> {
  const row = await tenant.db
    .prepare('SELECT 1 FROM metal_references WHERE organisation_id = ? AND id = ?')
    .bind(tenant.organisationId, referenceId)
    .first();
  return row !== null;
}

/** Creates the reference's calendar row if it has none yet (inside a batch). */
function ensureCalendar(tenant: Tenant, referenceId: string): D1PreparedStatement {
  return tenant.db
    .prepare(
      `INSERT OR IGNORE INTO publication_calendars (id, organisation_id, metal_reference_id, weekdays)
       VALUES (?, ?, ?, '')`
    )
    .bind(newId('cal'), tenant.organisationId, referenceId);
}

/** Admin only. Returns false when the reference is not in this organisation. */
export async function setWeekdays(
  tenant: Tenant,
  referenceId: string,
  input: z.infer<typeof weekdaysInput>
): Promise<boolean> {
  requireAdmin(tenant);
  if (!(await referenceExists(tenant, referenceId))) return false;
  const weekdays = input.weekdays.join(',');
  await tenant.db.batch([
    ensureCalendar(tenant, referenceId),
    tenant.db
      .prepare(
        'UPDATE publication_calendars SET weekdays = ? WHERE organisation_id = ? AND metal_reference_id = ?'
      )
      .bind(weekdays, tenant.organisationId, referenceId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'calendar.weekdays_changed',
      objectType: 'metal_reference',
      objectId: referenceId,
      details: { weekdays: input.weekdays },
    }),
  ]);
  return true;
}

/**
 * Admin only. Returns false when the reference is not in this organisation;
 * throws HolidayExistsError when the date is already a holiday.
 */
export async function addHoliday(
  tenant: Tenant,
  referenceId: string,
  input: HolidayInput
): Promise<boolean> {
  requireAdmin(tenant);
  const calendar = await getCalendar(tenant, referenceId);
  if (!calendar) return false;
  if (calendar.holidays.includes(input.date)) throw new HolidayExistsError();
  await tenant.db.batch([
    ensureCalendar(tenant, referenceId),
    tenant.db
      .prepare(
        `INSERT INTO publication_holidays (id, organisation_id, calendar_id, date, name)
         SELECT ?, organisation_id, id, ?, ? FROM publication_calendars
          WHERE organisation_id = ? AND metal_reference_id = ?`
      )
      .bind(newId('hol'), input.date, input.name, tenant.organisationId, referenceId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'calendar.holiday_added',
      objectType: 'metal_reference',
      objectId: referenceId,
      details: { date: input.date, name: input.name },
    }),
  ]);
  return true;
}

/** Admin only. Returns false when the reference or the holiday is not in this organisation. */
export async function removeHoliday(
  tenant: Tenant,
  referenceId: string,
  date: string
): Promise<boolean> {
  requireAdmin(tenant);
  const calendar = await getCalendar(tenant, referenceId);
  if (!calendar?.holidays.includes(date)) return false;
  await tenant.db.batch([
    tenant.db
      .prepare(
        `DELETE FROM publication_holidays
          WHERE organisation_id = ? AND date = ?
            AND calendar_id IN (SELECT id FROM publication_calendars
                                 WHERE organisation_id = ? AND metal_reference_id = ?)`
      )
      .bind(tenant.organisationId, date, tenant.organisationId, referenceId),
    auditStatement(tenant.db, {
      organisationId: tenant.organisationId,
      userId: tenant.userId,
      action: 'calendar.holiday_removed',
      objectType: 'metal_reference',
      objectId: referenceId,
      details: { date },
    }),
  ]);
  return true;
}
