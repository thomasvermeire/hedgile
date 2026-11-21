import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import {
  addHoliday,
  getCalendar,
  holidayInput,
  HolidayExistsError,
  listCalendars,
  removeHoliday,
  setWeekdays,
  weekdaysInput,
} from './calendars.server';
import { countPublicationDays } from './publication-days';

function tenant(db: D1Database, role: 'admin' | 'user'): Tenant {
  return {
    db,
    organisationId: 'org_hedgile',
    organisationName: 'Hedgile',
    userId: 'u_h',
    email: 'h@x.test',
    userName: null,
    role,
  };
}

const LME = 'ref_lme_ni_cash';
const MB = 'ref_mb_co_mbll';

describe('seeded calendars', () => {
  let db: D1Database;
  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u_h',
      email: 'h@x.test',
      role: 'admin',
    });
  });

  it('lists a calendar per active reference with weekdays and holidays', async () => {
    const calendars = await listCalendars(tenant(db, 'user'));
    const lme = calendars.find((c) => c.referenceId === LME);
    const mb = calendars.find((c) => c.referenceId === MB);
    expect(lme?.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(lme?.holidays).toHaveLength(8);
    expect(lme?.holidayList[0]).toEqual({ date: '2018-12-25', name: 'Christmas Day' });
    expect(mb?.weekdays).toEqual([3, 5]);
    expect(mb?.holidays).toEqual(['2019-04-19']);
  });

  it('gives the acceptance numbers from the seeded database', async () => {
    const t = tenant(db, 'user');
    const lme = await getCalendar(t, LME);
    const mb = await getCalendar(t, MB);
    expect(lme && countPublicationDays(lme, '2018-12-03', '2018-12-14')).toBe(10);
    expect(mb && countPublicationDays(mb, '2018-12-03', '2018-12-14')).toBe(4);
    expect(lme && countPublicationDays(lme, '2019-01-01', '2019-01-31')).toBe(22);
    expect(mb && countPublicationDays(mb, '2019-04-01', '2019-04-30')).toBe(7);
  });

  it('returns null for an unknown reference', async () => {
    expect(await getCalendar(tenant(db, 'user'), 'ref_nope')).toBeNull();
  });
});

describe('editing calendars', () => {
  let db: D1Database;
  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u_h',
      email: 'h@x.test',
      role: 'admin',
    });
  });

  it('an admin changes the weekdays, and it is audited', async () => {
    const admin = tenant(db, 'admin');
    expect(await setWeekdays(admin, MB, weekdaysInput.parse({ weekdays: ['5', '1', '1'] }))).toBe(
      true
    );
    const mb = await getCalendar(admin, MB);
    expect(mb?.weekdays).toEqual([1, 5]);
    expect(mb && countPublicationDays(mb, '2018-12-03', '2018-12-14')).toBe(4);
    const row = await db
      .prepare("SELECT details FROM audit_log WHERE action = 'calendar.weekdays_changed'")
      .first<{ details: string }>();
    expect(JSON.parse(row?.details ?? '{}')).toEqual({ weekdays: [1, 5] });
  });

  it('an admin adds a holiday (name optional) and removes it, each audited', async () => {
    const admin = tenant(db, 'admin');
    await addHoliday(admin, LME, holidayInput.parse({ date: '2019-01-02', name: ' Bonus ' }));
    await addHoliday(admin, LME, holidayInput.parse({ date: '2019-01-03' }));
    let lme = await getCalendar(admin, LME);
    expect(lme?.holidayList.filter((h) => h.date.startsWith('2019-01-0'))).toEqual([
      { date: '2019-01-01', name: "New Year's Day" },
      { date: '2019-01-02', name: 'Bonus' },
      { date: '2019-01-03', name: null },
    ]);
    expect(lme && countPublicationDays(lme, '2019-01-01', '2019-01-31')).toBe(20);

    expect(await removeHoliday(admin, LME, '2019-01-02')).toBe(true);
    expect(await removeHoliday(admin, LME, '2019-01-02')).toBe(false);
    lme = await getCalendar(admin, LME);
    expect(lme?.holidays).not.toContain('2019-01-02');

    const { results } = await db
      .prepare("SELECT action FROM audit_log WHERE action LIKE 'calendar.holiday_%' ORDER BY rowid")
      .all<{ action: string }>();
    expect(results.map((r) => r.action)).toEqual([
      'calendar.holiday_added',
      'calendar.holiday_added',
      'calendar.holiday_removed',
    ]);
  });

  it('refuses a duplicate holiday', async () => {
    await expect(
      addHoliday(tenant(db, 'admin'), LME, holidayInput.parse({ date: '2019-01-01' }))
    ).rejects.toBeInstanceOf(HolidayExistsError);
  });

  it('creates a calendar for a reference that has none', async () => {
    const admin = tenant(db, 'admin');
    await db
      .prepare(
        "INSERT INTO metal_references (id, organisation_id, metal, name, source) VALUES ('ref_new', 'org_hedgile', 'Zinc', 'LME Zinc', 'LME')"
      )
      .run();
    expect((await getCalendar(admin, 'ref_new'))?.weekdays).toEqual([]);
    await addHoliday(admin, 'ref_new', holidayInput.parse({ date: '2019-12-25' }));
    await setWeekdays(admin, 'ref_new', weekdaysInput.parse({ weekdays: [1, 2] }));
    const calendar = await getCalendar(admin, 'ref_new');
    expect(calendar?.weekdays).toEqual([1, 2]);
    expect(calendar?.holidays).toEqual(['2019-12-25']);
  });

  it('only an admin can edit', async () => {
    const user = tenant(db, 'user');
    await expect(
      setWeekdays(user, MB, weekdaysInput.parse({ weekdays: [1] }))
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      addHoliday(user, MB, holidayInput.parse({ date: '2019-06-01' }))
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeHoliday(user, MB, '2019-04-19')).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getCalendar(user, MB))?.weekdays).toEqual([3, 5]);
    expect((await getCalendar(user, MB))?.holidays).toEqual(['2019-04-19']);
  });
});

describe('input validation', () => {
  it('weekdays must be 1 to 7 and at least one', () => {
    expect(weekdaysInput.safeParse({ weekdays: ['0'] }).success).toBe(false);
    expect(weekdaysInput.safeParse({ weekdays: ['8'] }).success).toBe(false);
    expect(weekdaysInput.safeParse({ weekdays: ['x'] }).success).toBe(false);
    expect(weekdaysInput.safeParse({ weekdays: [] }).success).toBe(false);
    expect(weekdaysInput.parse({ weekdays: ['7', '1'] }).weekdays).toEqual([1, 7]);
  });

  it('holiday dates must be real dates', () => {
    expect(holidayInput.safeParse({ date: '2019-02-30' }).success).toBe(false);
    expect(holidayInput.safeParse({ date: '' }).success).toBe(false);
    expect(holidayInput.safeParse({ date: '19-01-01' }).success).toBe(false);
    expect(holidayInput.parse({ date: '2020-02-29', name: '' }).name).toBeNull();
  });
});
