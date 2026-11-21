import { describe, expect, it } from 'vitest';
import { deviationPct, exceedsTolerance, isParameterKey, parameterDefinitions } from './registry';

describe('exceedsTolerance', () => {
  it('flags a deviation above the tolerance, up or down', () => {
    expect(exceedsTolerance(100, 105.01, 5)).toBe(true);
    expect(exceedsTolerance(100, 94.99, 5)).toBe(true);
  });

  it('accepts a deviation below the tolerance', () => {
    expect(exceedsTolerance(100, 104, 5)).toBe(false);
    expect(exceedsTolerance(100, 100, 5)).toBe(false);
  });

  it('accepts a deviation exactly at the tolerance', () => {
    expect(exceedsTolerance(100, 105, 5)).toBe(false);
    expect(exceedsTolerance(100, 95, 5)).toBe(false);
    expect(exceedsTolerance(200, 210, 5)).toBe(false);
  });

  it('measures relative to the expected value, whatever its sign', () => {
    expect(deviationPct(50, 60)).toBeCloseTo(20);
    expect(deviationPct(-50, -60)).toBeCloseTo(20);
  });

  it('handles an expected value of zero', () => {
    expect(exceedsTolerance(0, 0, 5)).toBe(false);
    expect(exceedsTolerance(0, 0.001, 5)).toBe(true);
    expect(exceedsTolerance(0, -1, 100)).toBe(true);
  });

  it('a tighter tolerance flags what a looser one lets through', () => {
    expect(exceedsTolerance(100, 103, 5)).toBe(false);
    expect(exceedsTolerance(100, 103, 2.5)).toBe(true);
  });
});

describe('registry', () => {
  it('lists the tolerance with unit % and default 5', () => {
    const def = parameterDefinitions.three_way_match_tolerance_pct;
    expect(def.unit).toBe('%');
    expect(def.default).toBe(5);
    expect(def.schema.safeParse(def.default).success).toBe(true);
    expect(isParameterKey('three_way_match_tolerance_pct')).toBe(true);
    expect(isParameterKey('toString')).toBe(false);
  });
});
