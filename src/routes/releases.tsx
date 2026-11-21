import { requireTenant } from '../auth/guard.server.js';
import { ReleaseList } from '../versioning/ReleaseList';
import { releases } from '../versioning/releases';
import { getAppVersion } from '../versioning/version';
import type { Route } from './+types/releases';

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return { releases, currentVersion: getAppVersion().version };
}

export function meta() {
  return [{ title: 'Releases · Hedgile' }];
}

export default function Releases({ loaderData }: Route.ComponentProps) {
  return <ReleaseList releases={loaderData.releases} currentVersion={loaderData.currentVersion} />;
}
