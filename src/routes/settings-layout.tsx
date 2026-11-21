import { NavLink, Outlet } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { settingsSections } from '../settings/sections';
import { Lock } from '../ui/Lock';
import type { Route } from './+types/settings-layout';

export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  return null;
}

/** Settings: a sub-menu of sections around each settings page. */
export default function SettingsLayout() {
  return (
    <div className="settings">
      <nav className="settings__nav" aria-label="Settings">
        <ul>
          {settingsSections.map((s) => (
            <li key={s.path}>
              <NavLink
                to={s.path ? `/settings/${s.path}` : '/settings'}
                end={!s.path}
                className={({ isActive }) =>
                  isActive ? 'settings__link is-active' : 'settings__link'
                }
              >
                <span>{s.label}</span>
                {s.locked && <Lock label={`${s.label} is locked`} />}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="settings__page">
        <Outlet />
      </div>
    </div>
  );
}
