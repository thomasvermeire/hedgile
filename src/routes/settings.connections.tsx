import { requireTenant } from '../auth/guard.server.js';
import { ConnectionGroupCard, LockBanner } from '../settings/LockedSettings';
import { connectionGroups, connectionsIntro } from '../settings/locked-content';
import type { Route } from './+types/settings.connections';

export function meta() {
  return [{ title: 'Connections · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

export default function Page() {
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Connections</h1>
      <LockBanner>{connectionsIntro}</LockBanner>
      {connectionGroups.map((g) => (
        <ConnectionGroupCard key={g.id} group={g} />
      ))}
    </>
  );
}
