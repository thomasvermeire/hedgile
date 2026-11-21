/**
 * The menu, in the order of the foundations spec. Locked entries are shown
 * with a lock and open nothing; the modules that unlock them come later.
 * Icon names refer to src/navigation/icons.ts, the one place to swap the icon set.
 */
import type { IconName } from './icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Where the entry goes. Locked entries and plain groups have none. */
  path?: string;
  locked?: boolean;
  children?: MenuItem[];
}

export interface MetalReference {
  id: string;
  name: string;
}

function entry(base: string, label: string, locked = false): MenuItem {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return locked
    ? { id: `${base}/${slug}`, label, locked: true }
    : { id: `${base}/${slug}`, label, path: `${base}/${slug}` };
}

/** Build the menu; Market Data > Metals has one entry per active metal reference. */
export function buildMenu(activeReferences: MetalReference[]): MenuItem[] {
  return [
    {
      id: 'market-data',
      label: 'Market Data',
      icon: 'marketData',
      children: [
        {
          id: 'market-data/metals',
          label: 'Metals',
          icon: 'metals',
          children: activeReferences.map((ref) => ({
            id: `market-data/metals/${ref.id}`,
            label: ref.name,
            path: `/market-data/metals/${ref.id}`,
          })),
        },
        { id: 'market-data/currencies', label: 'Currencies', icon: 'currencies', locked: true },
      ],
    },
    {
      id: 'process',
      label: 'Process',
      icon: 'process',
      children: [
        {
          id: 'process/purchasing',
          label: 'Purchasing',
          icon: 'purchasing',
          children: [
            entry('/process/purchasing', 'Quotes', true),
            entry('/process/purchasing', 'Contracts'),
            entry('/process/purchasing', 'Call-offs'),
            entry('/process/purchasing', 'Deliveries'),
            entry('/process/purchasing', 'Inbound Delivery'),
            entry('/process/purchasing', 'Lots'),
            entry('/process/purchasing', 'Invoices', true),
          ],
        },
        {
          id: 'process/sales',
          label: 'Sales',
          icon: 'sales',
          children: [
            entry('/process/sales', 'Quotes', true),
            entry('/process/sales', 'Contracts'),
            entry('/process/sales', 'Call-offs'),
            entry('/process/sales', 'Deliveries'),
            entry('/process/sales', 'Outbound Delivery', true),
            entry('/process/sales', 'Lots'),
            entry('/process/sales', 'Invoices', true),
          ],
        },
        {
          id: 'process/quality',
          label: 'Quality',
          icon: 'quality',
          children: [
            entry('/process/quality', 'Inspection lots'),
            entry('/process/quality', 'Analysis'),
            entry('/process/quality', 'Certificates of Analysis'),
          ],
        },
        {
          id: 'process/hedging',
          label: 'Hedging',
          icon: 'hedging',
          children: [
            entry('/process/hedging', 'Paper Transactions', true),
            entry('/process/hedging', 'Valuation Run'),
            entry('/process/hedging', 'Reporting'),
          ],
        },
      ],
    },
    {
      id: 'master-data',
      label: 'Master Data',
      icon: 'masterData',
      children: [
        entry('/master-data', 'Companies'),
        entry('/master-data', 'Materials'),
        entry('/master-data', 'Customers'),
        entry('/master-data', 'Vendors'),
      ],
    },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ];
}

/** Find the menu entry for a path, with the labels of its parents (for page titles). */
export function findByPath(
  menu: MenuItem[],
  path: string,
  trail: string[] = []
): { item: MenuItem; trail: string[] } | null {
  for (const item of menu) {
    if (item.path === path) return { item, trail };
    if (item.children) {
      const found = findByPath(item.children, path, [...trail, item.label]);
      if (found) return found;
    }
  }
  return null;
}
