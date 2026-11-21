import { LogOut } from 'lucide-react';
import { Form, Link, Outlet } from 'react-router';
import { appConfig, requireTenant } from '../auth/guard.server.js';
import { LaimonPanel } from '../laimon/LaimonPanel';
import { listActiveReferences } from '../master-data/references.server.js';
import { getTestMode } from '../posting/test-mode.server.js';
import { buildMenu } from '../navigation/menu';
import { Sidebar } from '../navigation/Sidebar';
import { formatVersionLabel, getAppVersion } from '../versioning/version';
import type { Route } from './+types/app-layout';

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const references = await listActiveReferences(tenant);
  return {
    organisation: tenant.organisationName,
    user: { email: tenant.email, name: tenant.userName, role: tenant.role },
    references: references.map((r) => ({ id: r.id, name: r.name })),
    testMode: await getTestMode(tenant),
    laimonEnabled: Boolean(appConfig(args.context).ANTHROPIC_API_KEY),
  };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { organisation, user, references, testMode, laimonEnabled } = loaderData;
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            H
          </span>
          Hedgile
        </div>
        <Sidebar menu={buildMenu(references)} />
        <Link to="/releases" className="version-link" title="Releases">
          {formatVersionLabel(getAppVersion())}
        </Link>
      </aside>
      <div className="shell__main">
        <header className="topbar">
          <span className="topbar__org">{organisation}</span>
          {testMode && (
            <span
              className="badge badge--test-mode"
              title="Test mode is on: posting dates may be in the future"
            >
              Test mode
            </span>
          )}
          <Link to="/account" className="topbar__user" title="My account">
            {user.name ?? user.email}
            <span className="muted"> · {user.role}</span>
          </Link>
          <Form method="post" action="/auth/logout">
            <button type="submit" className="icon-button" aria-label="Sign out" title="Sign out">
              <LogOut aria-hidden="true" size={16} />
            </button>
          </Form>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      <LaimonPanel enabled={laimonEnabled} />
    </div>
  );
}
