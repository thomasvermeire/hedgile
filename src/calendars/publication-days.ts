/**
 * Publication calendars: on which days does a price source publish?
 *
 * `publicationDays` / `countPublicationDays` are the entry points the hedging
 * line split calls. They are pure (no database, no clock): hand them a
 * calendar read with `getCalendar` and an inclusive range of ISO dates.
 *
 * Dates are calendar dates (YYYY-MM-DD) handled in UTC, so the result never
 * depends on the machine's timezone or on daylight saving time.
 */
import { isIsoDate } from '../posting/dates.js';

export interface PublicationCalendar {
  /** ISO weekday numbers on which the source publishes: 1 = Monday ... 7 = Sunday. */
  weekdays: readonly number[];
  /** ISO dates (YYYY-MM-DD) on which it does not publish, even on a publishing weekday. */
  holidays: readonly string[];
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  if (!isIsoDate(date)) throw new RangeError(`Not a valid ISO date: ${date}`);
  return Date.parse(`${date}T00:00:00Z`);
}

/** ISO weekday of an ISO date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay() || 7;
}

/**
 * The days from `from` to `to` (both inclusive, ISO dates) on which the calendar
 * publishes: its weekdays, minus its holidays. Ascending. Empty when `from` is
 * after `to`. Throws RangeError for a date that is not a real calendar date.
 */
export function publicationDays(calendar: PublicationCalendar, from: string, to: string): string[] {
  const start = toUtcMs(from);
  const end = toUtcMs(to);
  const weekdays = new Set(calendar.weekdays);
  const holidays = new Set(calendar.holidays);
  const days: string[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const date = new Date(ms);
    const iso = date.toISOString().slice(0, 10);
    if (weekdays.has(date.getUTCDay() || 7) && !holidays.has(iso)) days.push(iso);
  }
  return days;
}

/** How many publishing days lie between `from` and `to`, both inclusive. */
export function countPublicationDays(
  calendar: PublicationCalendar,
  from: string,
  to: string
): number {
  return publicationDays(calendar, from, to).length;
}

/** Parse the stored comma-separated weekdays ('1,2,3,4,5') into sorted unique numbers. */
export function parseWeekdays(stored: string): number[] {
  const numbers = stored
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(numbers)].sort((a, b) => a - b);
}
