import { requireTenant } from '../auth/guard.server.js';
import { UnitsPage } from '../units/UnitsPage';
import type { Route } from './+types/settings.units';

export function meta() {
  return [{ title: 'Units of measure · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

export default function SettingsUnits() {
  return <UnitsPage />;
}
