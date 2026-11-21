import { requireTenant } from '../auth/guard.server.js';
import type { Route } from './+types/settings.currencies';

export function meta() {
  return [{ title: 'Currencies · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

/** Where base and reporting currencies per legal entity will be managed (its own story). */
export default function Currencies() {
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Currencies</h1>
      <div className="empty-state">
        <p>
          Base currency and reporting currency per legal entity are managed here. This page arrives
          with its own story in the backlog; until then a company&apos;s base currency stays as it
          is.
        </p>
      </div>
    </>
  );
}
