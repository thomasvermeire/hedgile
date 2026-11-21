import { describe, expect, it } from 'vitest';
import {
  connectionGroups,
  directionLabels,
  ledgerSections,
  valuationSections,
} from './locked-content';

describe('locked settings content', () => {
  it('has the three connection groups', () => {
    expect(connectionGroups.map((g) => g.id)).toEqual(['erp', 'market', 'logistics']);
  });

  it('gives every connection a direction, a purpose and an inactive status', () => {
    const all = connectionGroups.flatMap((g) => g.connections);
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const c of all) {
      expect(Object.keys(directionLabels)).toContain(c.direction);
      expect(c.purpose.trim()).not.toBe('');
      expect(c.status).toBe('inactive');
    }
  });

  it('has unique connection ids', () => {
    const ids = connectionGroups.flatMap((g) => g.connections.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists the expected ERP and market connections', () => {
    const erp = connectionGroups.find((g) => g.id === 'erp');
    const names = erp?.connections.map((c) => c.name) ?? [];
    for (const n of ['Material master data', 'Customer master data', 'Vendor master data']) {
      expect(names).toContain(n);
    }
    const market = connectionGroups.find((g) => g.id === 'market');
    expect(market?.connections.map((c) => c.name)).toEqual([
      'LME / Reuters prices',
      'ECB FX rates',
    ]);
  });

  it('explains every group and section', () => {
    for (const g of connectionGroups) expect(g.explanation.trim()).not.toBe('');
    for (const s of [...ledgerSections, ...valuationSections]) {
      expect(s.explanation.trim()).not.toBe('');
    }
  });
});
