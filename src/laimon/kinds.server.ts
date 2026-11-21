import { z } from 'zod';
import {
  companyKindInfo,
  type DraftFields,
  type ExtractedField,
  type ExtractionKindInfo,
} from './kinds.js';

export const extractedField = z.object({
  value: z.string().nullable(),
  confidence: z.number(),
  evidence: z.string().nullable(),
});

export interface ExtractionKind extends ExtractionKindInfo {
  instructions: string;
  schema: z.ZodObject<Record<string, typeof extractedField>>;
}

export const companyKind: ExtractionKind = {
  ...companyKindInfo,
  instructions:
    'Read the company that issued the document, or the counterparty it is addressed to when the issuer is the reader. country is the ISO 3166-1 alpha-2 code of the company address.',
  schema: z.object({
    name: extractedField,
    country: extractedField,
    vatNumber: extractedField,
    address: extractedField,
  }),
};

export const serverExtractionKinds: Record<string, ExtractionKind> = {
  [companyKind.id]: companyKind,
};

/** Keep confidence within 0-1 and empty strings as null, whatever the model returned. */
export function normaliseFields(
  kind: ExtractionKindInfo,
  raw: Record<string, ExtractedField>
): DraftFields {
  const out: DraftFields = {};
  for (const name of Object.keys(kind.fields)) {
    const field = raw[name];
    const value = field?.value?.trim() ? field.value.trim() : null;
    const confidence = value === null ? 0 : Math.min(1, Math.max(0, field?.confidence ?? 0));
    out[name] = { value, confidence, evidence: field?.evidence?.trim() || null };
  }
  return out;
}
