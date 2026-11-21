import { describe, expect, it } from 'vitest';
import {
  add,
  amount,
  calculate,
  div,
  equals,
  mul,
  roundQuantity,
  roundTo,
  roundValue,
  toDecimalString,
} from './decimal';
import { formatDecimal } from './format';
import { convert, convertText } from './units';

const text = (a: ReturnType<typeof amount>, places: number) => toDecimalString(a, places);

describe('convert', () => {
  it('converts 49,888.97413 lb to kg (exact arithmetic: 22,629.25803)', () => {
    // The story quotes 22,629.2581; exact division gives 22629.258031472..., i.e. 22629.25803 at
    // 5 decimals (22,629.2580 at 4). We assert the real value.
    const kg = convert(amount('49888.97413'), 'lb', 'kg');
    expect(text(kg, 9)).toBe('22629.258031472');
    expect(toDecimalString(roundQuantity(kg))).toBe('22629.25803');
    expect(convertText({ quantity: '49888.97413', from: 'lb', to: 'kg' })).toBe('22629.25803');
    expect(formatDecimal(convertText({ quantity: '49888.97413', from: 'lb', to: 'kg' }))).toBe(
      '22,629.25803'
    );
  });

  it('uses 2.20462262 lb per kg and 1000 kg per mt', () => {
    expect(convertText({ quantity: '1', from: 'kg', to: 'lb' })).toBe('2.20462');
    expect(toDecimalString(convert(amount('1'), 'kg', 'lb'))).toBe('2.20462262');
    expect(convertText({ quantity: '2.5', from: 'mt', to: 'kg' })).toBe('2500.00000');
    expect(convertText({ quantity: '1', from: 'mt', to: 'lb' })).toBe('2204.62262');
  });

  it('keeps kg -> lb -> kg exact before final rounding', () => {
    for (const q of ['1', '0.1', '12345.6789', '0.00001', '999999.99999']) {
      const back = convert(convert(amount(q), 'kg', 'lb'), 'lb', 'kg');
      expect(equals(back, amount(q))).toBe(true);
    }
    const viaMt = convert(convert(amount('7.3'), 'mt', 'lb'), 'lb', 'mt');
    expect(equals(viaMt, amount('7.3'))).toBe(true);
  });

  it('is not subject to float drift', () => {
    expect(toDecimalString(add(amount('0.1'), amount('0.2')))).toBe('0.3');
  });

  it('returns the same quantity for the same unit and refuses unknown units', () => {
    const q = amount('5.5');
    expect(convert(q, 'kg', 'kg')).toBe(q);
    // @ts-expect-error units are a closed set
    expect(() => convert(q, 'stone', 'kg')).toThrow();
  });
});

describe('rounding', () => {
  it('rounds half up to 5 and 2 decimals', () => {
    expect(text(roundQuantity(amount('1.000005')), 5)).toBe('1.00001');
    expect(text(roundQuantity(amount('1.000004999')), 5)).toBe('1.00000');
    expect(toDecimalString(roundValue(amount('2.345')))).toBe('2.35');
    expect(toDecimalString(roundValue(amount('2.344999')))).toBe('2.34');
    expect(toDecimalString(roundValue(amount('0.005')))).toBe('0.01');
    expect(toDecimalString(roundValue(amount('0.004')))).toBe('0');
    expect(toDecimalString(roundTo(amount('2.5'), 0))).toBe('3');
  });

  it('rounds ties away from zero for negatives', () => {
    expect(toDecimalString(roundValue(amount('-2.345')))).toBe('-2.35');
    expect(toDecimalString(roundTo(amount('-0.5'), 0))).toBe('-1');
    expect(text(roundValue(amount('-0.004')), 2)).toBe('0.00');
  });

  it('rounds exact thirds correctly', () => {
    expect(text(div(amount('2'), amount('3')), 2)).toBe('0.67');
    expect(text(div(amount('1'), amount('3')), 5)).toBe('0.33333');
  });

  it('refuses a non-terminating amount without places', () => {
    expect(() => toDecimalString(div(amount('1'), amount('3')))).toThrow(RangeError);
  });
});

describe('calculate: round only at the end', () => {
  it('differs from rounding the intermediate values', () => {
    // 1 lb in kg, then 1,000,000 of them, priced at 1.5 per kg.
    const exact = calculate(
      ({ mul: m }) => m(m(convert(amount('1'), 'lb', 'kg'), amount('1000000')), amount('1.5')),
      roundValue
    );
    const roundedEarly = roundValue(
      mul(mul(roundQuantity(convert(amount('1'), 'lb', 'kg')), amount('1000000')), amount('1.5'))
    );
    expect(toDecimalString(exact)).toBe('680388.56');
    expect(toDecimalString(roundedEarly)).toBe('680385');
    expect(equals(exact, roundedEarly)).toBe(false);
  });
});

describe('input validation', () => {
  it('refuses anything that is not a plain decimal', () => {
    for (const bad of ['', 'abc', '1e5', '1,000', '1.', '.5', '--1', 'NaN', '1 2']) {
      expect(() => amount(bad)).toThrow();
    }
    expect(() => convertText({ quantity: 'x', from: 'kg', to: 'lb' })).toThrow();
    expect(() =>
      convertText({ quantity: '1', from: 'stone' as unknown as 'kg', to: 'lb' })
    ).toThrow();
  });

  it('refuses division by zero', () => {
    expect(() => div(amount('1'), amount('0'))).toThrow(RangeError);
  });
});

describe('formatDecimal', () => {
  it('adds thousands separators and optionally trims trailing zeros', () => {
    expect(formatDecimal('22629.25810')).toBe('22,629.25810');
    expect(formatDecimal('22629.25810', { trimZeros: true })).toBe('22,629.2581');
    expect(formatDecimal('1000000.00000', { trimZeros: true })).toBe('1,000,000');
    expect(formatDecimal('-1234567')).toBe('-1,234,567');
    expect(formatDecimal('999')).toBe('999');
    expect(() => formatDecimal('1e5')).toThrow();
  });
});
