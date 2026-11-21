import type { Route } from './+types/health';

/** Public liveness check: the Worker runs and can reach its database. */
export async function loader({ context }: Route.LoaderArgs): Promise<Response> {
  let database = 'ok';
  try {
    await context.cloudflare.env.DB.prepare('SELECT 1').first();
  } catch {
    database = 'unavailable';
  }
  return Response.json(
    { status: database === 'ok' ? 'ok' : 'degraded', app: 'hedgile', database },
    { status: database === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
