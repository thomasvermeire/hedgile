import { z } from 'zod';

/** A percentage above 0 and up to 100, with at most two decimals. Accepts "5", "2.5" or 5. */
const tolerancePct = z
  .preprocess(
    (v) => (typeof v === 'number' ? String(v) : v),
    z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage with at most 2 decimals')
  )
  .transform(Number)
  .pipe(z.number().gt(0, 'Must be more than 0').max(100, 'Must be at most 100'));

/**
 * Every organisation parameter, one entry each. To add a parameter, add an entry here:
 * the page, `getParameter`, `setParameter` and the history pick it up.
 */
export const parameterDefinitions = {
  three_way_match_tolerance_pct: {
    label: 'Three-way-match tolerance',
    description:
      'The three-way match flags a field (quantity, assay, price, amount) when it deviates by more than this percentage.',
    unit: '%',
    schema: tolerancePct,
    default: 5,
  },
} as const;

export type ParameterKey = keyof typeof parameterDefinitions;
export type ParameterValue<K extends ParameterKey> = z.output<
  (typeof parameterDefinitions)[K]['schema']
>;

export const parameterKeys = Object.keys(parameterDefinitions) as ParameterKey[];

export function isParameterKey(key: string): key is ParameterKey {
  return Object.prototype.hasOwnProperty.call(parameterDefinitions, key);
}

/** Relative deviation, in percent, of `actual` from `expected`; see `exceedsTolerance`. */
export function deviationPct(expected: number, actual: number): number {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return (Math.abs(actual - expected) / Math.abs(expected)) * 100;
}

/**
 * Whether `actual` deviates from `expected` by MORE than `tolerancePct` percent.
 *
 * Formula: |actual - expected| / |expected| × 100 > tolerancePct.
 * Exactly at the tolerance is within it (not flagged). When `expected` is 0 the relative
 * deviation is undefined: equal values (0 and 0) are within tolerance, any other actual
 * value exceeds it. Pure; callers read the tolerance with `threeWayMatchTolerance`.
 */
export function exceedsTolerance(expected: number, actual: number, tolerancePct: number): boolean {
  return deviationPct(expected, actual) > tolerancePct;
}
