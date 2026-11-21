import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { appConfig, requireTenant } from '../auth/guard.server.js';
import { chat, LaimonDeclinedError, LaimonUnavailableError } from '../laimon/claude.server.js';
import { createLogger } from '../utils/logger.js';
import type { Route } from './+types/api.laimon.chat';

const body = z.object({
  page: z.string().max(300).default('/'),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30)
    .refine(
      (m) => m[0]?.role === 'user' && m[m.length - 1]?.role === 'user',
      'Must start and end with the user'
    ),
});

export async function action(args: Route.ActionArgs): Promise<Response> {
  const tenant = await requireTenant(args);
  const config = appConfig(args.context);
  const logger = createLogger(config.LOG_LEVEL);
  if (args.request.method !== 'POST')
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });

  const parsed = body.safeParse(await args.request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  try {
    const reply = await chat(config, parsed.data.messages, {
      organisation: tenant.organisationName,
      page: parsed.data.page,
    });
    return Response.json({ reply });
  } catch (error) {
    if (error instanceof LaimonUnavailableError)
      return Response.json({ error: error.message }, { status: 503 });
    if (error instanceof LaimonDeclinedError)
      return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Laimon is busy, try again in a minute' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      logger.error('Laimon chat failed', { status: error.status, message: error.message });
      return Response.json({ error: 'Laimon could not answer right now' }, { status: 502 });
    }
    throw error;
  }
}
