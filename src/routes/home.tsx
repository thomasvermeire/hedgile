import { Link } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import type { Route } from './+types/home';

export function meta() {
  return [{ title: 'Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const counts = await tenant.db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM companies WHERE organisation_id = ?1) AS companies,
              (SELECT COUNT(*) FROM materials WHERE organisation_id = ?1) AS materials`
    )
    .bind(tenant.organisationId)
    .first<{ companies: number; materials: number }>();
  return {
    name: tenant.userName ?? tenant.email,
    counts: counts ?? { companies: 0, materials: 0 },
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1>Welcome, {loaderData.name}</h1>
      <p className="muted">
        The modules unlock one by one. Start with the master data, or drop a document on Laimon.
      </p>
      <div className="stats">
        <Link to="/master-data/companies" className="stat">
          <span className="stat__value">{loaderData.counts.companies}</span>
          <span className="stat__label">Companies</span>
        </Link>
        <Link to="/master-data/materials" className="stat">
          <span className="stat__value">{loaderData.counts.materials}</span>
          <span className="stat__label">Materials</span>
        </Link>
      </div>
    </>
  );
}
