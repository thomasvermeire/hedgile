import { requireTenant } from '../auth/guard.server.js';
import { SectionStub } from '../settings/SectionStub';
import type { Route } from './+types/settings.valuation';

export function meta() {
  return [{ title: 'Valuation & result recognition · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

export default function Page() {
  return <SectionStub title="Valuation & result recognition" locked />;
}
