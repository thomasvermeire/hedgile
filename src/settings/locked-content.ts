/**
 * What the locked Settings sections will bring. Static content, shared by the
 * pages and their tests; nothing here is stored or editable yet.
 */
export type Direction = 'inbound' | 'outbound' | 'both';

export const directionLabels: Record<Direction, string> = {
  inbound: 'Into Hedgile',
  outbound: 'From Hedgile',
  both: 'Both ways',
};

export const directionArrows: Record<Direction, string> = {
  inbound: '←',
  outbound: '→',
  both: '↔',
};

export interface Connection {
  id: string;
  name: string;
  /** Relative to Hedgile. */
  direction: Direction;
  purpose: string;
  status: 'inactive';
}

export interface ConnectionGroup {
  id: 'erp' | 'market' | 'logistics';
  title: string;
  /** What will come. */
  explanation: string;
  connections: Connection[];
}

export const connectionGroups: ConnectionGroup[] = [
  {
    id: 'erp',
    title: 'ERP',
    explanation:
      'Hedgile will exchange master data, trades and postings with your ERP through MCP events, so nothing is typed twice.',
    connections: [
      {
        id: 'erp-material',
        name: 'Material master data',
        direction: 'inbound',
        purpose: 'Receive materials and their units and quality stages from the ERP.',
        status: 'inactive',
      },
      {
        id: 'erp-customer',
        name: 'Customer master data',
        direction: 'inbound',
        purpose: 'Receive customers, with their credit and payment terms.',
        status: 'inactive',
      },
      {
        id: 'erp-vendor',
        name: 'Vendor master data',
        direction: 'inbound',
        purpose: 'Receive vendors, with their payment terms and bank details.',
        status: 'inactive',
      },
      {
        id: 'erp-orders',
        name: 'Purchase orders and contracts',
        direction: 'both',
        purpose: 'Share contracts and orders so both systems hold the same open quantities.',
        status: 'inactive',
      },
      {
        id: 'erp-goods',
        name: 'Goods receipts and deliveries',
        direction: 'inbound',
        purpose: 'Receive physical movements to settle quantities and fix provisional prices.',
        status: 'inactive',
      },
      {
        id: 'erp-invoices',
        name: 'Invoices',
        direction: 'outbound',
        purpose: 'Send provisional and final invoices priced in Hedgile.',
        status: 'inactive',
      },
      {
        id: 'erp-payments',
        name: 'Payments',
        direction: 'inbound',
        purpose: 'Receive payment status to close open items.',
        status: 'inactive',
      },
      {
        id: 'erp-gl',
        name: 'GL postings',
        direction: 'outbound',
        purpose: 'Send metal and non-metal journal entries to the general ledger.',
        status: 'inactive',
      },
    ],
  },
  {
    id: 'market',
    title: 'Market',
    explanation:
      'Hedgile will fetch published prices and rates itself instead of you entering them.',
    connections: [
      {
        id: 'market-lme-reuters',
        name: 'LME / Reuters prices',
        direction: 'inbound',
        purpose: 'Receive published metal prices for the metal references.',
        status: 'inactive',
      },
      {
        id: 'market-ecb-fx',
        name: 'ECB FX rates',
        direction: 'inbound',
        purpose: 'Receive the daily euro reference exchange rates.',
        status: 'inactive',
      },
    ],
  },
  {
    id: 'logistics',
    title: 'Logistics providers',
    explanation:
      'Hedgile will follow shipments with your logistics providers to know when goods arrive.',
    connections: [
      {
        id: 'logistics-shipments',
        name: 'Shipment status',
        direction: 'inbound',
        purpose: 'Receive shipping milestones and arrival dates from logistics providers.',
        status: 'inactive',
      },
      {
        id: 'logistics-bookings',
        name: 'Transport bookings',
        direction: 'outbound',
        purpose: 'Send transport instructions for sales and purchase deliveries.',
        status: 'inactive',
      },
    ],
  },
];

export interface LockedSection {
  id: string;
  title: string;
  /** What will come. */
  explanation: string;
}

export const connectionsIntro =
  'Connections are locked. They arrive with the integration story; for now this page shows what Hedgile will connect to, and in which direction.';

export const ledgerSections: LockedSection[] = [
  {
    id: 'financial-gl',
    title: 'Financial GL',
    explanation:
      'Will split every posting into a metal and a non-metal part and map each to a chart-of-accounts account, ready to send to your general ledger.',
  },
  {
    id: 'metal-ledger',
    title: 'Metal Accounting Ledger',
    explanation:
      'Will keep the metal positions per legal entity as a ledger of its own, next to the financial GL.',
  },
];

export const valuationSections: LockedSection[] = [
  {
    id: 'strategic-inventory',
    title: 'Strategic inventory',
    explanation:
      'Will let you mark inventory held as a strategic stock and value it separately from trading inventory.',
  },
  {
    id: 'result-recognition',
    title: 'Result recognition principles',
    explanation:
      'Will set when a trade result is recognised in the books, for instance on delivery or on final pricing.',
  },
];
