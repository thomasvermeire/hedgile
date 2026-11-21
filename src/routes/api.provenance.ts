import { requireTenant } from '../auth/guard.server.js';
import { getProvenance } from '../provenance/provenance.server.js';
import { provenanceQuery } from '../provenance/provenance.js';
import type { Route } from './+types/api.provenance';

/** Why a value is what it is: its latest provenance and history. */
export async function loader(args: Route.LoaderArgs): Promise<Response> {
  const tenant = await requireTenant(args);
  const params = new URL(args.request.url).searchParams;
  const parsed = provenanceQuery.safeParse({
    objectType: params.get('objectType'),
    objectId: params.get('objectId'),
    field: params.get('field'),
  });
  if (!parsed.success) return Response.json({ error: 'invalid_request' }, { status: 400 });
  const { objectType, objectId, field } = parsed.data;
  const result = await getProvenance(tenant, objectType, objectId, field);
  if (!result) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
