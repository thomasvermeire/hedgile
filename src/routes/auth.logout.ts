import { redirect } from 'react-router';
import { appConfig } from '../auth/guard.server.js';
import { authCookies } from '../auth/session.server.js';
import type { Route } from './+types/auth.logout';

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const { sessions } = authCookies(appConfig(context));
  const session = await sessions.getSession(request.headers.get('Cookie'));
  return redirect('/auth/signed-out', {
    headers: { 'Set-Cookie': await sessions.destroySession(session) },
  });
}

export function loader(): Response {
  return redirect('/');
}
