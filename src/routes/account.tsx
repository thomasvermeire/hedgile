import { data, Form, redirect, useNavigation } from 'react-router';
import { changeOwnPassword, WrongPasswordError } from '../auth/account.server.js';
import { appConfig, requireTenant } from '../auth/guard.server.js';
import { sessionStorage } from '../auth/session.server.js';
import { passwordChangeInput } from '../settings/members.server.js';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/account';

export function meta() {
  return [{ title: 'My account · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  return { email: tenant.email, name: tenant.userName, changed: url.searchParams.has('changed') };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const parsed = parseForm(passwordChangeInput, await args.request.formData());
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
  let version: number;
  try {
    version = await changeOwnPassword(tenant, parsed.data.current, parsed.data.password);
  } catch (error) {
    if (error instanceof WrongPasswordError)
      return data({ errors: { current: error.message } }, { status: 400 });
    throw error;
  }
  // Keep this browser signed in; every other session of this account is now signed out.
  const sessions = sessionStorage(appConfig(args.context));
  const session = await sessions.getSession(args.request.headers.get('Cookie'));
  session.set('sessionVersion', version);
  return redirect('/account?changed', {
    headers: { 'Set-Cookie': await sessions.commitSession(session) },
  });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  return (
    <>
      <h1>My account</h1>
      <p className="muted">
        {loaderData.name ? `${loaderData.name} · ` : ''}
        {loaderData.email}
      </p>
      {loaderData.changed && (
        <p className="notice">Your password was changed. Other sessions were signed out.</p>
      )}
      <Form method="post" className="panel-form narrow">
        <h2>Change password</h2>
        <Field
          label="Current password"
          name="current"
          type="password"
          error={errors.current}
          required
        />
        <Field
          label="New password"
          name="password"
          type="password"
          error={errors.password}
          required
        />
        <Field
          label="New password again"
          name="confirm"
          type="password"
          error={errors.confirm}
          required
        />
        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            Change password
          </button>
        </div>
      </Form>
    </>
  );
}
