import { data } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { getReference } from '../master-data/references.server.js';
import { KnownBadge } from '../ui/KnownBadge';
import type { Route } from './+types/market-data.metal';

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const reference = await getReference(tenant, args.params.referenceId);
  if (!reference) throw data('Not found', { status: 404 });
  return { reference };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.reference.name ?? 'Metal'} · Hedgile` }];
}

export default function MetalReference({ loaderData }: Route.ComponentProps) {
  const { reference } = loaderData;
  return (
    <>
      <p className="breadcrumb">Market Data / Metals</p>
      <h1>{reference.name}</h1>
      <p className="muted">
        {reference.metal} · source {reference.source}
      </p>
      <div className="empty-state">
        <p>
          Prices arrive with the Market Data module. Each price will show{' '}
          <KnownBadge status="known" /> when it is published for that date, or{' '}
          <KnownBadge status="last_known" /> when the latest earlier price is used.
        </p>
      </div>
    </>
  );
}
