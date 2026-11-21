import { data } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { buildMenu, findByPath } from '../navigation/menu';
import type { Route } from './+types/module-placeholder';

/** Menu entries whose module is not built yet get this page; anything else is a 404. */
export async function loader(args: Route.LoaderArgs) {
  await requireTenant(args);
  const path = new URL(args.request.url).pathname.replace(/\/$/, '');
  const found = findByPath(buildMenu([]), path);
  if (!found) throw data('Not found', { status: 404 });
  return { title: found.item.label, trail: found.trail };
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.title ?? 'Hedgile'} · Hedgile` }];
}

export default function ModulePlaceholder({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <p className="breadcrumb">{loaderData.trail.join(' / ')}</p>
      <h1>{loaderData.title}</h1>
      <div className="empty-state">
        <p>This module is not built yet. It arrives with its own story in the backlog.</p>
      </div>
    </>
  );
}
