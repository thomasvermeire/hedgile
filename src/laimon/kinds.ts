/**
 * What Laimon can read from a document: the labels shown in the panel and on
 * the summary screen. Safe for the browser; the schemas Laimon fills are in
 * kinds.server.ts. Later modules add kinds (contracts, invoices, CoAs).
 */
export interface ExtractedField {
  value: string | null;
  /** 0-1: how sure Laimon is that the value is right. */
  confidence: number;
  /** The passage of the document it read the value from. */
  evidence: string | null;
}

export type DraftFields = Record<string, ExtractedField>;

export interface ExtractionKindInfo {
  id: string;
  label: string;
  /** Field name -> label shown on the summary screen, in display order. */
  fields: Record<string, string>;
}

export const companyKindInfo: ExtractionKindInfo = {
  id: 'company',
  label: 'Company (from a letter, invoice or contract)',
  fields: {
    name: 'Name',
    country: 'Country (two letters)',
    vatNumber: 'VAT number',
    address: 'Address',
  },
};

export const extractionKinds: Record<string, ExtractionKindInfo> = {
  [companyKindInfo.id]: companyKindInfo,
};

export function confidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
