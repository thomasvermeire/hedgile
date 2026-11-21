import { requireTenant } from '../auth/guard.server.js';
import { LockBanner, LockedCard } from '../settings/LockedSettings';
import { valuationSections } from '../settings/locked-content';
import { listCompanyValuations } from '../settings/valuation.server.js';
import { ValuationOverview } from '../settings/ValuationOverview';
import type { Route } from './+types/settings.valuation';

export function meta() {
  return [{ title: 'Valuation & result recognition · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  return { valuations: await listCompanyValuations(tenant) };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Valuation &amp; result recognition</h1>
      <LockBanner>
        Valuation settings are locked. They arrive with the accounting story; the overview below is
        read-only.
      </LockBanner>
      <ValuationOverview valuations={loaderData.valuations} />
      {valuationSections.map((s) => (
        <LockedCard key={s.id} section={s} />
      ))}
    </>
  );
}
