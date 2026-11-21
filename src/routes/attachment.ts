import { data } from 'react-router';
import { appEnv, requireTenant } from '../auth/guard.server.js';
import { getAttachment } from '../master-data/attachments.server.js';
import type { Route } from './+types/attachment';

/** Download an attachment of the signed-in user's organisation. */
export async function loader(args: Route.LoaderArgs): Promise<Response> {
  const tenant = await requireTenant(args);
  const attachment = await getAttachment(tenant, args.params.attachmentId);
  if (!attachment) throw data('Not found', { status: 404 });
  const object = await appEnv(args.context).ATTACHMENTS.get(attachment.r2Key);
  if (!object) throw data('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Disposition': `inline; filename="${attachment.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
