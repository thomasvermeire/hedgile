import { z } from 'zod';

/**
 * Exact decimal arithmetic for quantities and values. No floats anywhere.
 *
 * An Amount is an exact fraction `num / den` of bigints (den > 0, lowest terms), so a
 * division such as lb -> kg stays exact until someone rounds it. Rounding is half up:
 * a tie rounds away from zero (2.5 -> 3, -2.5 -> -3).
 */
export interface Amount {
  readonly num: bigint;
  readonly den: bigint;
}

/** A plain decimal string such as "49888.97413" or "-0.5"; no exponents, no thousands separators. */
export const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'Enter a number such as 1250.5');

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function make(num: bigint, den: bigint): Amount {
  if (den === 0n) throw new RangeError('Division by zero');
  const sign = den < 0n ? -1n : 1n;
  const g = gcd(num, den) || 1n;
  return { num: (sign * num) / g, den: (sign * den) / g };
}

/** Parse a decimal string exactly. Throws a ZodError on anything else (floats are refused). */
export function amount(input: string): Amount {
  const text = decimalString.parse(input);
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const num = BigInt(whole + fraction);
  return make(negative ? -num : num, 10n ** BigInt(fraction.length));
}

export const add = (a: Amount, b: Amount): Amount =>
  make(a.num * b.den + b.num * a.den, a.den * b.den);
export const sub = (a: Amount, b: Amount): Amount =>
  make(a.num * b.den - b.num * a.den, a.den * b.den);
export const mul = (a: Amount, b: Amount): Amount => make(a.num * b.num, a.den * b.den);
export const div = (a: Amount, b: Amount): Amount => make(a.num * b.den, a.den * b.num);
export const equals = (a: Amount, b: Amount): boolean => a.num === b.num && a.den === b.den;

/** Round to `places` decimals, half up (ties away from zero). Returns an exact Amount. */
export function roundTo(a: Amount, places: number): Amount {
  if (!Number.isInteger(places) || places < 0) throw new RangeError('places must be >= 0');
  const scale = 10n ** BigInt(places);
  const scaled = a.num * scale;
  const abs = scaled < 0n ? -scaled : scaled;
  let q = abs / a.den;
  if ((abs % a.den) * 2n >= a.den) q += 1n;
  return make(scaled < 0n ? -q : q, scale);
}

/** Quantities are rounded to 5 decimals, only at the end of a calculation. */
export const roundQuantity = (a: Amount): Amount => roundTo(a, 5);

/** Values (money) are rounded to 2 decimals, only at the end of a calculation. */
export const roundValue = (a: Amount): Amount => roundTo(a, 2);

/**
 * Exact decimal string with a fixed number of decimals (rounded half up), e.g. "22629.25803".
 * Without `places` the amount must terminate (e.g. an already rounded amount); otherwise it throws.
 */
export function toDecimalString(a: Amount, places?: number): string {
  let p = 0;
  let r = a;
  if (places === undefined) {
    while ((a.num * 10n ** BigInt(p)) % a.den !== 0n) {
      if (++p > 40) throw new RangeError('Amount has no finite decimal form; pass places');
    }
  } else {
    p = places;
    r = roundTo(a, p);
  }
  const scaled = (r.num * 10n ** BigInt(p)) / r.den;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(p + 1, '0');
  const whole = digits.slice(0, digits.length - p);
  const fraction = digits.slice(digits.length - p);
  return `${negative ? '-' : ''}${whole}${p > 0 ? `.${fraction}` : ''}`;
}

/**
 * Pattern for every later calculation: do all steps unrounded, round once at the end.
 *
 *   const total = calculate(({ mul }) => mul(price, convert(qty, 'lb', 'kg')), roundValue);
 *
 * The callback only gets exact operations, so nothing inside it can round by accident.
 */
export function calculate(
  steps: (ops: { add: typeof add; sub: typeof sub; mul: typeof mul; div: typeof div }) => Amount,
  finish: (a: Amount) => Amount
): Amount {
  return finish(steps({ add, sub, mul, div }));
}
