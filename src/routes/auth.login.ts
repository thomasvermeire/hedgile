import { redirect } from 'react-router';
import { appConfig } from '../auth/guard.server.js';
import { beginSignIn } from '../auth/oidc.server.js';
import { authCookies, safeReturnTo } from '../auth/session.server.js';
import type { Route } from './+types/auth.login';

/** Start LaimonID sign-in: the only way into Hedgile. */
export async function loader({ request, context }: Route.LoaderArgs): Promise<Response> {
  const config = appConfig(context);
  const url = new URL(request.url);
  const { url: authorizeUrl, pending } = await beginSignIn(
    {
      issuer: config.LAIMONID_ISSUER,
      clientId: config.LAIMONID_CLIENT_ID,
      clientSecret: config.LAIMONID_CLIENT_SECRET,
    },
    `${url.origin}/auth/callback`,
    safeReturnTo(url.searchParams.get('returnTo'))
  );
  return redirect(authorizeUrl, {
    headers: { 'Set-Cookie': await authCookies(config).pendingSignIn.serialize(pending) },
  });
}
