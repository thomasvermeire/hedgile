import { requireTenant } from '../auth/guard.server.js';
import { UnitsPage } from '../units/UnitsPage';

// No './+types/settings.units' import: that file only exists once the route is listed in
// src/routes.ts, so this route typechecks before and after it is registered.
export async function loader(args: Parameters<typeof requireTenant>[0]) {
  await requireTenant(args);
  return {};
}

export function meta() {
  return [{ title: 'Units · Hedgile' }];
}

export default function SettingsUnits() {
  return <UnitsPage />;
}
