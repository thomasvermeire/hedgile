/** Rules for the active/inactive periods of a book metal. Pure: no database, no clock. */
import { isIsoDate } from '../posting/dates';

export type PeriodStatus = 'active' | 'inactive';

export interface Period {
  id: string;
  status: PeriodStatus;
  /** YYYY-MM-DD */
  validFrom: string;
  /** YYYY-MM-DD, inclusive; null = indefinitely. */
  validTo: string | null;
}

export interface PeriodDraft {
  status: PeriodStatus;
  validFrom: string;
  validTo: string | null;
}

/** A period that ended before today: its status can no longer change. */
export function isPastPeriod(period: Pick<Period, 'validTo'>, today: string): boolean {
  return period.validTo !== null && period.validTo < today;
}

/** A new period starts today and runs indefinitely unless dates are given. */
export function defaultPeriod(today: string, status: PeriodStatus = 'active'): PeriodDraft {
  return { status, validFrom: today, validTo: null };
}

/** True when the two inclusive ranges share at least one day. */
export function overlaps(
  a: Pick<Period, 'validFrom' | 'validTo'>,
  b: Pick<Period, 'validFrom' | 'validTo'>
): boolean {
  const aEndsBeforeB = a.validTo !== null && a.validTo < b.validFrom;
  const bEndsBeforeA = b.validTo !== null && b.validTo < a.validFrom;
  return !aEndsBeforeB && !bEndsBeforeA;
}

/** The period in force on a date, if any. */
export function periodOn(periods: readonly Period[], date: string): Period | undefined {
  return periods.find((p) => p.validFrom <= date && (p.validTo === null || p.validTo >= date));
}

/** Is the metal active on this date? */
export function isActiveOn(periods: readonly Period[], date: string): boolean {
  return periodOn(periods, date)?.status === 'active';
}

export interface PeriodProblem {
  field: 'status' | 'validFrom' | 'validTo';
  message: string;
}

/**
 * Checks a new or changed period against the metal's other periods.
 * `existing` is the period being changed (absent for a new one); `others` excludes it.
 */
export function checkPeriod(
  draft: PeriodDraft,
  others: readonly Period[],
  today: string,
  existing?: Period
): PeriodProblem | null {
  if (!isIsoDate(draft.validFrom)) {
    return { field: 'validFrom', message: 'Enter a valid start date (YYYY-MM-DD)' };
  }
  if (draft.validTo !== null && !isIsoDate(draft.validTo)) {
    return { field: 'validTo', message: 'Enter a valid end date (YYYY-MM-DD) or leave it empty' };
  }
  if (draft.validTo !== null && draft.validTo < draft.validFrom) {
    return { field: 'validTo', message: 'The end date cannot be before the start date' };
  }
  if (existing && isPastPeriod(existing, today) && draft.status !== existing.status) {
    return { field: 'status', message: 'A period that has ended cannot change status' };
  }
  const clash = others.find((o) => overlaps(draft, o));
  if (clash) {
    return {
      field: 'validFrom',
      message: `Overlaps another period (${clash.validFrom} to ${clash.validTo ?? 'open-ended'})`,
    };
  }
  return null;
}
