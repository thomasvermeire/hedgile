import { data, Form, redirect, useNavigation, useSearchParams } from 'react-router';
import { z } from 'zod';
import { appConfig, appEnv } from '../auth/guard.server.js';
import { safeReturnTo, sessionStorage } from '../auth/session.server.js';
import { LOCK_MINUTES, signIn } from '../tenancy/membership.server.js';
import { AuthCard } from '../ui/AuthCard';
import { Field } from '../ui/Field';
import { createLogger } from '../utils/logger.js';
import type { Route } from './+types/auth.login';

export function meta() {
  return [{ title: 'Sign in · Hedgile' }];
}

const credentials = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(500),
  returnTo: z.string().optional(),
});

const messages = {
  invalid: 'The email or password is not right.',
  locked: `Too many wrong passwords. The account is locked for ${LOCK_MINUTES} minutes.`,
  no_membership: 'Your account is not a member of any organisation. Ask an admin to add you.',
} as const;

/** Already signed in: go straight to the app. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await sessionStorage(appConfig(context)).getSession(
    request.headers.get('Cookie')
  );
  if (session.get('userId'))
    throw redirect(safeReturnTo(new URL(request.url).searchParams.get('returnTo')));
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const config = appConfig(context);
  const logger = createLogger(config.LOG_LEVEL);
  const parsed = credentials.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: messages.invalid }, { status: 400 });

  const result = await signIn(appEnv(context).DB, parsed.data.email, parsed.data.password, {
    email: config.BOOTSTRAP_ADMIN_EMAIL,
    password: config.BOOTSTRAP_ADMIN_PASSWORD,
  });
  if (!result.ok) {
    logger.warn('Sign-in refused', { reason: result.reason });
    return data(
      { error: messages[result.reason] },
      { status: result.reason === 'locked' ? 429 : 401 }
    );
  }

  const sessions = sessionStorage(config);
  const session = await sessions.getSession();
  session.set('userId', result.userId);
  session.set('organisationId', result.membership.organisationId);
  session.set('sessionVersion', result.sessionVersion);
  logger.info('Signed in', {
    userId: result.userId,
    organisationId: result.membership.organisationId,
  });
  return redirect(safeReturnTo(parsed.data.returnTo), {
    headers: { 'Set-Cookie': await sessions.commitSession(session) },
  });
}

export default function SignIn({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const busy = useNavigation().state === 'submitting';
  return (
    <AuthCard title="Sign in">
      <Form method="post" className="auth__form">
        <input type="hidden" name="returnTo" value={params.get('returnTo') ?? '/'} />
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        {actionData?.error && (
          <p className="field__error" role="alert">
            {actionData.error}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          Sign in
        </button>
      </Form>
    </AuthCard>
  );
}
