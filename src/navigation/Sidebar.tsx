import { NavLink, useLocation } from 'react-router';
import { Lock } from '../ui/Lock';
import { icons } from './icons';
import type { MenuItem } from './menu';

function contains(item: MenuItem, pathname: string): boolean {
  if (item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`))) return true;
  return item.children?.some((c) => contains(c, pathname)) ?? false;
}

function Entry({ item, depth }: { item: MenuItem; depth: number }) {
  const { pathname } = useLocation();
  const Icon = item.icon ? icons[item.icon] : null;
  const label = (
    <>
      {Icon && <Icon aria-hidden="true" size={16} className="nav__icon" />}
      <span className="nav__label">{item.label}</span>
    </>
  );

  if (item.locked) {
    return (
      <li>
        <span className="nav__item nav__item--locked" aria-disabled="true">
          {label}
          <Lock label={`${item.label} is locked`} />
        </span>
      </li>
    );
  }

  if (item.children) {
    return (
      <li>
        <details className="nav__group" open={depth === 0 || contains(item, pathname)}>
          <summary className="nav__item nav__item--group">{label}</summary>
          {item.children.length > 0 ? (
            <ul className="nav__list">
              {item.children.map((child) => (
                <Entry key={child.id} item={child} depth={depth + 1} />
              ))}
            </ul>
          ) : (
            <p className="nav__empty">No active references</p>
          )}
        </details>
      </li>
    );
  }

  return (
    <li>
      <NavLink
        to={item.path ?? '/'}
        className={({ isActive }) => (isActive ? 'nav__item is-active' : 'nav__item')}
      >
        {label}
      </NavLink>
    </li>
  );
}

export function Sidebar({ menu }: { menu: MenuItem[] }) {
  return (
    <nav className="nav" aria-label="Main">
      <ul className="nav__list nav__list--root">
        {menu.map((item) => (
          <Entry key={item.id} item={item} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
