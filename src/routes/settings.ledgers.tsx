import { requireTenant } from '../auth/guard.server.js';
import { SectionStub } from '../settings/SectionStub';
import type { Route } from './+types/settings.ledgers';

export function meta() {
  return [{ title: 'Ledgers · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

export default function Page() {
  return <SectionStub title="Ledgers" locked />;
}
