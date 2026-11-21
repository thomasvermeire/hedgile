import { z } from 'zod';

/** What caused a value to be stored or recalculated. */
export const TRIGGERS = ['market', 'quantity', 'quality', 'pricing_conditions', 'manual'] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const MODES = ['automatic', 'manual'] as const;

export const TRIGGER_LABELS: Record<Trigger, string> = {
  market: 'Market',
  quantity: 'Quantity',
  quality: 'Quality',
  pricing_conditions: 'Pricing conditions',
  manual: 'Manual',
};

/** One named input of a calculation, optionally with where it came from. */
export const provenanceInput = z.object({
  name: z.string().trim().min(1).max(60),
  value: z.union([z.string().max(200), z.number().finite()]),
  source: z.string().trim().max(200).optional(),
});
export type ProvenanceInput = z.infer<typeof provenanceInput>;

const objectKey = z.string().trim().min(1).max(100);

/**
 * What a caller records next to a write. A formula is plain, human-readable text
 * (e.g. `price × quantity`) that names its inputs; it is never evaluated.
 */
export const provenanceEntry = z
  .object({
    objectType: objectKey,
    objectId: objectKey,
    field: objectKey,
    value: z.union([z.string().max(500), z.number().finite()]).transform(String),
    trigger: z.enum(TRIGGERS),
    mode: z.enum(MODES),
    formula: z.string().trim().min(1).max(300).nullish(),
    inputs: z.array(provenanceInput).max(30).nullish(),
  })
  .refine((e) => e.trigger !== 'manual' || e.mode === 'manual', {
    message: 'A manual trigger must have mode manual',
    path: ['mode'],
  })
  .refine((e) => !e.inputs?.length || Boolean(e.formula), {
    message: 'Inputs need a formula',
    path: ['formula'],
  });
export type ProvenanceEntryInput = z.input<typeof provenanceEntry>;

/** The query of GET /api/provenance. */
export const provenanceQuery = z.object({
  objectType: objectKey,
  objectId: objectKey,
  field: objectKey,
});

export interface ProvenanceRecord {
  id: string;
  objectType: string;
  objectId: string;
  field: string;
  value: string;
  trigger: Trigger;
  mode: 'automatic' | 'manual';
  formula: string | null;
  inputs: ProvenanceInput[] | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

export interface ProvenanceResult {
  latest: ProvenanceRecord;
  history: ProvenanceRecord[];
}

/** 12300 -> "12 300"; 0.5 -> "0.5"; non-numbers are returned as they are. */
export function formatValue(value: string | number): string {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  const [whole = '', fraction] = text.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * "price × quantity" with {price: 12300, quantity: 5} and result 61500 reads
 * "price × quantity = 12 300 × 5 = 61 500". Input names are swapped for their
 * values by plain text matching (longest name first); nothing is evaluated.
 */
export function renderCalculation(
  formula: string,
  inputs: readonly ProvenanceInput[],
  result: string | number
): string {
  const names = [...new Set(inputs.map((i) => i.name))].sort((a, b) => b.length - a.length);
  const values = new Map(inputs.map((i) => [i.name, formatValue(i.value)]));
  let substituted = formula;
  if (names.length > 0) {
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:${escaped.join('|')})(?![\\p{L}\\p{N}_])`,
      'gu'
    );
    substituted = formula.replace(pattern, (name) => values.get(name) ?? name);
  }
  return `${formula} = ${substituted} = ${formatValue(result)}`;
}
