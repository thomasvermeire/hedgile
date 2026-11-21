import { describe, expect, it } from 'vitest';
import { elements, findElement } from './elements';
import {
  checkPeriod,
  defaultPeriod,
  isActiveOn,
  isPastPeriod,
  overlaps,
  type Period,
} from './periods';

const TODAY = '2026-11-21';
const open: Period = { id: 'p1', status: 'active', validFrom: '2018-12-01', validTo: null };

describe('period rules', () => {
  it('a new period starts today and runs indefinitely', () => {
    expect(defaultPeriod(TODAY)).toEqual({ status: 'active', validFrom: TODAY, validTo: null });
  });

  it('a period that ended before today is past; today and open-ended are not', () => {
    expect(isPastPeriod({ validTo: '2026-11-20' }, TODAY)).toBe(true);
    expect(isPastPeriod({ validTo: TODAY }, TODAY)).toBe(false);
    expect(isPastPeriod({ validTo: null }, TODAY)).toBe(false);
  });

  it('refuses a status change on a past period but allows it when the status is kept', () => {
    const past: Period = {
      id: 'p2',
      status: 'active',
      validFrom: '2020-01-01',
      validTo: '2020-12-31',
    };
    expect(
      checkPeriod(
        { status: 'inactive', validFrom: past.validFrom, validTo: past.validTo },
        [],
        TODAY,
        past
      )
    ).toMatchObject({ field: 'status' });
    expect(
      checkPeriod(
        { status: 'active', validFrom: past.validFrom, validTo: '2020-12-30' },
        [],
        TODAY,
        past
      )
    ).toBeNull();
  });

  it('allows a status change on a current period', () => {
    expect(
      checkPeriod({ status: 'inactive', validFrom: open.validFrom, validTo: null }, [], TODAY, open)
    ).toBeNull();
  });

  it('refuses overlapping periods, inclusive of the end date', () => {
    const ended: Period = {
      id: 'p3',
      status: 'inactive',
      validFrom: '2018-01-01',
      validTo: '2018-12-31',
    };
    expect(overlaps(ended, { validFrom: '2018-12-31', validTo: null })).toBe(true);
    expect(overlaps(ended, { validFrom: '2019-01-01', validTo: null })).toBe(false);
    expect(checkPeriod(defaultPeriod(TODAY), [open], TODAY)).toMatchObject({ field: 'validFrom' });
    expect(checkPeriod(defaultPeriod(TODAY), [ended], TODAY)).toBeNull();
  });

  it('refuses bad dates and an end before the start', () => {
    expect(
      checkPeriod({ status: 'active', validFrom: '2026-02-30', validTo: null }, [], TODAY)
    ).toMatchObject({
      field: 'validFrom',
    });
    expect(
      checkPeriod({ status: 'active', validFrom: TODAY, validTo: 'soon' }, [], TODAY)
    ).toMatchObject({
      field: 'validTo',
    });
    expect(
      checkPeriod({ status: 'active', validFrom: TODAY, validTo: '2026-11-01' }, [], TODAY)
    ).toMatchObject({ field: 'validTo' });
  });

  it('is active on a date only inside an active period', () => {
    const periods: Period[] = [
      { id: 'a', status: 'active', validFrom: '2020-01-01', validTo: '2020-12-31' },
      { id: 'b', status: 'inactive', validFrom: '2021-01-01', validTo: null },
    ];
    expect(isActiveOn(periods, '2020-06-01')).toBe(true);
    expect(isActiveOn(periods, '2021-06-01')).toBe(false);
    expect(isActiveOn(periods, '2019-06-01')).toBe(false);
  });
});

describe('periodic table data', () => {
  it('has all 118 elements, in order, at distinct positions', () => {
    expect(elements).toHaveLength(118);
    expect(elements.map((e) => e.number)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(elements.map((e) => `${e.column}/${e.row}`)).size).toBe(118);
  });

  it('knows nickel and cobalt as metals and metalloids as non-metals', () => {
    expect(findElement('Ni')).toMatchObject({
      name: 'Nickel',
      number: 28,
      period: 4,
      group: 10,
      isMetal: true,
    });
    expect(findElement('Co')).toMatchObject({ name: 'Cobalt', number: 27, isMetal: true });
    for (const s of ['H', 'C', 'O', 'Si', 'Ge', 'As', 'Sb', 'Te', 'B', 'He']) {
      expect(findElement(s)?.isMetal).toBe(false);
    }
    expect(findElement('La')?.group).toBeNull();
    expect(findElement('Xx')).toBeUndefined();
  });
});
