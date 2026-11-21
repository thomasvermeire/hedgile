import { describe, expect, it } from 'vitest';
import { buildMenu, findByPath, type MenuItem } from './menu';

const labels = (items: MenuItem[] | undefined) => (items ?? []).map((i) => i.label);
const child = (items: MenuItem[] | undefined, label: string) =>
  items?.find((i) => i.label === label);

describe('buildMenu', () => {
  const menu = buildMenu([{ id: 'ref_lme_ni_cash', name: 'LME Nickel Cash' }]);

  it('has the top level in the spec order', () => {
    expect(labels(menu)).toEqual(['Market Data', 'Process', 'Master Data', 'Settings']);
  });

  it('lists one Metals entry per active reference, and Currencies locked', () => {
    const marketData = child(menu, 'Market Data');
    expect(labels(marketData?.children)).toEqual(['Metals', 'Currencies']);
    expect(labels(child(marketData?.children, 'Metals')?.children)).toEqual(['LME Nickel Cash']);
    expect(child(marketData?.children, 'Currencies')?.locked).toBe(true);
  });

  it('has every Process entry in order, with the locks from the spec', () => {
    const process = child(menu, 'Process')?.children;
    expect(labels(process)).toEqual(['Purchasing', 'Sales', 'Quality', 'Hedging']);
    const shape = (label: string) =>
      child(process, label)?.children?.map((i) => `${i.label}${i.locked ? ' (locked)' : ''}`);
    expect(shape('Purchasing')).toEqual([
      'Quotes (locked)',
      'Contracts',
      'Call-offs',
      'Deliveries',
      'Inbound Delivery',
      'Lots',
      'Invoices (locked)',
    ]);
    expect(shape('Sales')).toEqual([
      'Quotes (locked)',
      'Contracts',
      'Call-offs',
      'Deliveries',
      'Outbound Delivery (locked)',
      'Lots',
      'Invoices (locked)',
    ]);
    expect(shape('Quality')).toEqual(['Inspection lots', 'Analysis', 'Certificates of Analysis']);
    expect(shape('Hedging')).toEqual(['Paper Transactions (locked)', 'Valuation Run', 'Reporting']);
  });

  it('has the Master Data entries in order', () => {
    expect(labels(child(menu, 'Master Data')?.children)).toEqual([
      'Companies',
      'Materials',
      'Customers',
      'Vendors',
    ]);
  });

  it('gives locked entries no path, so they cannot navigate', () => {
    const all: MenuItem[] = [];
    const walk = (items: MenuItem[]) =>
      items.forEach((i) => {
        all.push(i);
        if (i.children) walk(i.children);
      });
    walk(menu);
    const locked = all.filter((i) => i.locked);
    expect(locked).toHaveLength(7);
    expect(locked.every((i) => i.path === undefined)).toBe(true);
  });

  it('finds an entry and its parents by path', () => {
    const found = findByPath(menu, '/process/sales/call-offs');
    expect(found?.item.label).toBe('Call-offs');
    expect(found?.trail).toEqual(['Process', 'Sales']);
  });
});
