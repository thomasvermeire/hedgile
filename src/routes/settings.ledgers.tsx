import { requireTenant } from '../auth/guard.server.js';
import { LockBanner, LockedCard } from '../settings/LockedSettings';
import { ledgerSections } from '../settings/locked-content';
import type { Route } from './+types/settings.ledgers';

export function meta() {
  return [{ title: 'Ledgers · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

export default function Page() {
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Ledgers</h1>
      <LockBanner>Ledgers are locked. They arrive with the accounting story.</LockBanner>
      {ledgerSections.map((s) => (
        <LockedCard key={s.id} section={s} />
      ))}
    </>
  );
}
