/**
 * System date and posting date for transactions.
 *
 * Every transaction table (contracts, receipts, analyses, invoices, quotes,
 * prices) has these two columns:
 *   system_date  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 *   posting_date TEXT NOT NULL            -- ISO calendar date, YYYY-MM-DD (UTC)
 * The system date is when the row was written and is never edited. The posting
 * date defaults to today, may be in the past (backdated, flagged in lists) and
 * may only be in the future when the organisation is in test mode.
 */
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the text is a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's calendar date in UTC as YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The calendar date (UTC) of a system date: an ISO date or timestamp. */
export function dateOf(systemDate: string): string {
  return systemDate.slice(0, 10);
}

/** A posting date before the day the row was written (system date) is backdated. */
export function isBackdated(postingDate: string, systemDate: string): boolean {
  return postingDate < dateOf(systemDate);
}

export const FUTURE_POSTING_MESSAGE =
  'Posting date cannot be in the future unless the organisation is in test mode';

/**
 * Validates a posting date. Empty or missing means today; past dates are
 * accepted; future dates are refused unless `testMode` is on.
 */
export function postingDateSchema({
  testMode,
  today: todayDate = today(),
}: {
  testMode: boolean;
  today?: string;
}) {
  return z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : todayDate))
    .refine(isIsoDate, 'Enter a valid date (YYYY-MM-DD)')
    .refine((v) => testMode || !isIsoDate(v) || v <= todayDate, FUTURE_POSTING_MESSAGE);
}
