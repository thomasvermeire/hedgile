import { describe, expect, it } from 'vitest';
import {
  dateOf,
  FUTURE_POSTING_MESSAGE,
  isBackdated,
  isIsoDate,
  postingDateSchema,
  today,
} from './dates';

describe('date helpers', () => {
  it('today is the UTC calendar date', () => {
    expect(today(new Date('2026-11-21T23:59:59Z'))).toBe('2026-11-21');
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('flags a posting date before the system date as backdated', () => {
    expect(isBackdated('2026-11-20', '2026-11-21T10:00:00.000Z')).toBe(true);
    expect(isBackdated('2026-11-21', '2026-11-21T10:00:00.000Z')).toBe(false);
    expect(isBackdated('2026-11-22', '2026-11-21T10:00:00.000Z')).toBe(false);
    expect(dateOf('2026-11-21T10:00:00.000Z')).toBe('2026-11-21');
  });

  it('accepts only real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('21/11/2026')).toBe(false);
  });
});

describe('postingDateSchema', () => {
  const todayDate = '2026-11-21';

  it('defaults to today when empty or missing', () => {
    const schema = postingDateSchema({ testMode: false, today: todayDate });
    expect(schema.parse(undefined)).toBe(todayDate);
    expect(schema.parse('')).toBe(todayDate);
  });

  it('accepts today and past dates outside test mode', () => {
    const schema = postingDateSchema({ testMode: false, today: todayDate });
    expect(schema.parse('2026-11-21')).toBe('2026-11-21');
    expect(schema.parse('2018-12-31')).toBe('2018-12-31');
  });

  it('refuses future dates outside test mode', () => {
    const result = postingDateSchema({ testMode: false, today: todayDate }).safeParse('2026-11-22');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(FUTURE_POSTING_MESSAGE);
  });

  it('allows future dates in test mode', () => {
    expect(postingDateSchema({ testMode: true, today: todayDate }).parse('2027-01-01')).toBe(
      '2027-01-01'
    );
  });

  it('refuses text that is not a date', () => {
    const result = postingDateSchema({ testMode: true, today: todayDate }).safeParse('soon');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/valid date/);
  });
});
