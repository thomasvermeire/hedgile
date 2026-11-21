import { describe, expect, it } from 'vitest';
import {
  countPublicationDays,
  isoWeekday,
  parseWeekdays,
  publicationDays,
  type PublicationCalendar,
} from './publication-days';

// Seed-equivalent data (migrations/0006_settings_foundations.sql).
const lme: PublicationCalendar = {
  weekdays: [1, 2, 3, 4, 5],
  holidays: [
    '2018-12-25',
    '2018-12-26',
    '2019-01-01',
    '2019-04-19',
    '2019-04-22',
    '2019-05-06',
    '2019-05-27',
    '2019-08-26',
  ],
};
const mb: PublicationCalendar = { weekdays: [3, 5], holidays: ['2019-04-19'] };
const everyDay: PublicationCalendar = { weekdays: [1, 2, 3, 4, 5, 6, 7], holidays: [] };

describe('publicationDays: acceptance numbers', () => {
  it('3 to 14 December 2018 has 10 LME days and 4 MB days', () => {
    expect(countPublicationDays(lme, '2018-12-03', '2018-12-14')).toBe(10);
    expect(publicationDays(mb, '2018-12-03', '2018-12-14')).toEqual([
      '2018-12-05',
      '2018-12-07',
      '2018-12-12',
      '2018-12-14',
    ]);
  });

  it('January 2019 has 22 LME days (New Year is a holiday)', () => {
    expect(countPublicationDays(lme, '2019-01-01', '2019-01-31')).toBe(22);
  });

  it('April 2019 has 7 MB days (Good Friday is a holiday)', () => {
    const days = publicationDays(mb, '2019-04-01', '2019-04-30');
    expect(days).toHaveLength(7);
    expect(days).not.toContain('2019-04-19');
  });
});

describe('publicationDays: edge cases', () => {
  it('is empty when from is after to', () => {
    expect(publicationDays(lme, '2019-01-10', '2019-01-09')).toEqual([]);
  });

  it('counts a single day, inclusive of both ends', () => {
    expect(publicationDays(lme, '2019-01-02', '2019-01-02')).toEqual(['2019-01-02']);
    expect(publicationDays(lme, '2019-01-01', '2019-01-01')).toEqual([]);
    expect(publicationDays(lme, '2019-01-05', '2019-01-05')).toEqual([]); // Saturday
  });

  it('ignores a holiday that falls on a non-publishing weekend day', () => {
    const cal = { weekdays: [1, 2, 3, 4, 5], holidays: ['2019-01-05'] };
    expect(countPublicationDays(cal, '2019-01-01', '2019-01-07')).toBe(5);
  });

  it('handles leap years', () => {
    expect(countPublicationDays(everyDay, '2020-02-01', '2020-02-29')).toBe(29);
    expect(countPublicationDays(everyDay, '2019-02-01', '2019-03-01')).toBe(29);
    expect(countPublicationDays(everyDay, '2020-01-01', '2020-12-31')).toBe(366);
    // 29 February 2020 is a Saturday
    expect(publicationDays(lme, '2020-02-28', '2020-03-02')).toEqual(['2020-02-28', '2020-03-02']);
  });

  it('does not drift across a daylight saving change', () => {
    expect(publicationDays(everyDay, '2019-03-30', '2019-04-02')).toEqual([
      '2019-03-30',
      '2019-03-31',
      '2019-04-01',
      '2019-04-02',
    ]);
  });

  it('is empty for a calendar with no weekdays', () => {
    expect(publicationDays({ weekdays: [], holidays: [] }, '2019-01-01', '2019-01-31')).toEqual([]);
  });

  it('rejects dates that are not real', () => {
    expect(() => publicationDays(lme, '2019-02-30', '2019-03-01')).toThrow(RangeError);
    expect(() => publicationDays(lme, '2019-02-01', 'tomorrow')).toThrow(RangeError);
  });
});

describe('helpers', () => {
  it('isoWeekday numbers Monday 1 to Sunday 7', () => {
    expect(isoWeekday('2019-04-01')).toBe(1);
    expect(isoWeekday('2019-04-07')).toBe(7);
  });

  it('parseWeekdays reads the stored text and drops junk', () => {
    expect(parseWeekdays('3,5')).toEqual([3, 5]);
    expect(parseWeekdays('5, 3,3,9,x')).toEqual([3, 5]);
    expect(parseWeekdays('')).toEqual([]);
  });
});
