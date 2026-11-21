import { redirect } from 'react-router';
import { appConfig, appEnv } from '../auth/guard.server.js';
import { completeSignIn, SignInError } from '../auth/oidc.server.js';
import { authCookies, readPendingSignIn } from '../auth/session.server.js';
import { resolveSignIn } from '../tenancy/membership.server.js';
import { createLogger } from '../utils/logger.js';
import type { Route } from './+types/auth.callback';

export async function loader({ request, context }: Route.LoaderArgs): Promise<Response> {
  const env = appEnv(context);
  const config = appConfig(context);
  const logger = createLogger(config.LOG_LEVEL);
  const url = new URL(request.url);
  const cookies = authCookies(config);
  const clearPending = await cookies.pendingSignIn.serialize('', { maxAge: 0 });
  const pending = await readPendingSignIn(config, request);

  try {
    const identity = await completeSignIn(
      {
        issuer: config.LAIMONID_ISSUER,
        clientId: config.LAIMONID_CLIENT_ID,
        clientSecret: config.LAIMONID_CLIENT_SECRET,
      },
      `${url.origin}/auth/callback`,
      url.searchParams,
      pending
    );
    const result = await resolveSignIn(env.DB, identity, config.BOOTSTRAP_ADMIN_EMAILS);
    if (!result.ok) {
      logger.warn('Sign-in refused', { reason: result.reason, email: identity.email });
      return redirect(`/auth/no-access?reason=${result.reason}`, {
        headers: { 'Set-Cookie': clearPending },
      });
    }

    const session = await cookies.sessions.getSession();
    session.set('userId', result.userId);
    session.set('organisationId', result.membership.organisationId);
    logger.info('Signed in', {
      userId: result.userId,
      organisationId: result.membership.organisationId,
    });
    const headers = new Headers();
    headers.append('Set-Cookie', clearPending);
    headers.append('Set-Cookie', await cookies.sessions.commitSession(session));
    return redirect(pending?.returnTo ?? '/', { headers });
  } catch (error) {
    if (!(error instanceof SignInError)) throw error;
    logger.warn('Sign-in failed', { problem: error.message });
    return redirect(`/auth/no-access?reason=failed`, { headers: { 'Set-Cookie': clearPending } });
  }
}
