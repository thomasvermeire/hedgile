/**
 * Laimon's calls to the Claude API. Laimon reads and explains; it never
 * writes figures into Hedgile itself. Extraction returns a typed draft that
 * the user confirms before anything is saved.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { AppConfig } from '../config/env.js';
import type { DraftFields, ExtractedField } from './kinds.js';
import { normaliseFields, type ExtractionKind } from './kinds.server.js';

// On a policy decline the API re-runs the request on a fallback model it picks.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

const SYSTEM = `You are Laimon, the assistant inside Hedgile, an application for metal trading teams (contracts, call-offs, deliveries, lots, quality, hedging, master data).
Answer briefly and concretely. You cannot change data in Hedgile: to create something from a document, the user drops a PDF on the Laimon panel, you prepare a draft, and they confirm it.
Never invent prices, quantities or other figures. If you do not know, say so.`;

export class LaimonUnavailableError extends Error {
  constructor(message = 'Laimon is switched off: no ANTHROPIC_API_KEY is set') {
    super(message);
    this.name = 'LaimonUnavailableError';
  }
}

export class LaimonDeclinedError extends Error {
  constructor() {
    super('Laimon could not help with this request');
    this.name = 'LaimonDeclinedError';
  }
}

function client(config: AppConfig): Anthropic {
  if (!config.ANTHROPIC_API_KEY) throw new LaimonUnavailableError();
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(
  config: AppConfig,
  turns: ChatTurn[],
  context: { organisation: string; page: string }
): Promise<string> {
  const response = await client(config).beta.messages.create({
    ...FALLBACK,
    model: config.LAIMON_MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: `${SYSTEM}\nOrganisation: ${context.organisation}. The user is on page ${context.page}.`,
    messages: turns,
  });
  if (response.stop_reason === 'refusal') throw new LaimonDeclinedError();
  return response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();
}

export interface Extractor {
  extract(kind: ExtractionKind, pdf: ArrayBuffer): Promise<{ fields: DraftFields; model: string }>;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function claudeExtractor(config: AppConfig): Extractor {
  return {
    async extract(kind, pdf) {
      const fieldList = Object.entries(kind.fields)
        .map(([name, label]) => `- ${name}: ${label}`)
        .join('\n');
      const response = await client(config).beta.messages.parse({
        ...FALLBACK,
        model: config.LAIMON_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'medium', format: betaZodOutputFormat(kind.schema) },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: toBase64(pdf) },
              },
              {
                type: 'text',
                text: `${kind.instructions}

Fill these fields only with text that appears in the document:
${fieldList}

For each field give value (exactly as written, or null when the document does not state it - never guess or compute), confidence (0 to 1: how sure you are that value is right for this field) and evidence (the short passage you read it from, or null).`,
              },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal') throw new LaimonDeclinedError();
      if (!response.parsed_output) throw new Error('Laimon returned no readable draft');
      return {
        fields: normaliseFields(kind, response.parsed_output as Record<string, ExtractedField>),
        model: response.model,
      };
    },
  };
}
