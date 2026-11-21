import Anthropic from '@anthropic-ai/sdk';
import { appConfig, appEnv, requireTenant } from '../auth/guard.server.js';
import {
  claudeExtractor,
  LaimonDeclinedError,
  LaimonUnavailableError,
} from '../laimon/claude.server.js';
import { createDraft, InvalidDocumentError } from '../laimon/drafts.server.js';
import { serverExtractionKinds } from '../laimon/kinds.server.js';
import { createLogger } from '../utils/logger.js';
import type { Route } from './+types/api.laimon.extract';

/** Upload a PDF; Laimon reads it into a draft and the user is sent to check it. */
export async function action(args: Route.ActionArgs): Promise<Response> {
  const tenant = await requireTenant(args);
  const config = appConfig(args.context);
  const logger = createLogger(config.LOG_LEVEL);

  const form = await args.request.formData().catch(() => null);
  const file = form?.get('file');
  const kind = serverExtractionKinds[String(form?.get('kind') ?? 'company')];
  if (!(file instanceof File) || !kind) {
    return Response.json(
      { error: 'Attach a PDF and choose what to read from it' },
      { status: 400 }
    );
  }

  try {
    const draftId = await createDraft(
      tenant,
      appEnv(args.context).ATTACHMENTS,
      claudeExtractor(config),
      kind,
      file
    );
    return Response.json({ draftUrl: `/laimon/drafts/${draftId}` });
  } catch (error) {
    if (error instanceof InvalidDocumentError)
      return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof LaimonUnavailableError)
      return Response.json({ error: error.message }, { status: 503 });
    if (error instanceof LaimonDeclinedError)
      return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Laimon is busy, try again in a minute' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      logger.error('Laimon extraction failed', { status: error.status, message: error.message });
      return Response.json(
        { error: 'Laimon could not read this document right now' },
        { status: 502 }
      );
    }
    throw error;
  }
}
