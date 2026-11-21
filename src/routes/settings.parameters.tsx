import { data, Form, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import {
  getParameter,
  InvalidParameterError,
  parameterHistory,
  setParameter,
} from '../parameters/parameters.server.js';
import { parameterDefinitions, parameterKeys, type ParameterKey } from '../parameters/registry.js';
import { ForbiddenError } from '../tenancy/tenant.js';
import { Field } from '../ui/Field';
import type { Route } from './+types/settings.parameters';

export function meta() {
  return [{ title: 'Parameters · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const parameters = await Promise.all(
    parameterKeys.map(async (key) => {
      const def = parameterDefinitions[key];
      return {
        key,
        label: def.label,
        description: def.description,
        unit: def.unit,
        value: String(await getParameter(tenant, key)),
        history: await parameterHistory(tenant, key),
      };
    })
  );
  return { parameters, isAdmin: tenant.role === 'admin' };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const key = form.get('key');
  if (typeof key !== 'string' || !(key in parameterDefinitions)) {
    throw data('Unknown parameter', { status: 400 });
  }
  const value = form.get('value');
  try {
    await setParameter(tenant, key as ParameterKey, typeof value === 'string' ? value : '');
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof InvalidParameterError) {
      return data({ errors: { [error.key]: error.message } }, { status: 400 });
    }
    throw error;
  }
  return redirect('/settings/parameters');
}

function who(change: { userName: string | null; userEmail: string | null }): string {
  return change.userName ?? change.userEmail ?? 'Unknown user';
}

export default function Parameters({ loaderData, actionData }: Route.ComponentProps) {
  const { parameters, isAdmin } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';

  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Parameters</h1>
      {parameters.map((p) => (
        <section key={p.key} className="panel-form parameter" aria-label={p.label}>
          <h2>{p.label}</h2>
          <p className="muted">{p.description}</p>
          {isAdmin ? (
            <Form method="post">
              <input type="hidden" name="key" value={p.key} />
              <div className="parameter__value">
                <Field
                  label={`${p.label} (${p.unit})`}
                  name="value"
                  defaultValue={p.value}
                  error={errors[p.key]}
                  required
                />
                <span className="parameter__unit" aria-hidden="true">
                  {p.unit}
                </span>
              </div>
              <div className="form-actions">
                <button type="submit" className="button button--primary" disabled={busy}>
                  Save
                </button>
              </div>
            </Form>
          ) : (
            <p className="parameter__current">
              <strong>
                {p.value} {p.unit}
              </strong>{' '}
              <span className="muted">Only an admin can change this.</span>
            </p>
          )}
          <h3>History</h3>
          {p.history.length === 0 ? (
            <p className="muted">Not changed yet; the default applies.</p>
          ) : (
            <table className="parameter__history">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {p.history.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <time dateTime={c.at}>{c.at.slice(0, 16).replace('T', ' ')} UTC</time>
                    </td>
                    <td>{who(c)}</td>
                    <td>
                      {String(c.oldValue)} {p.unit} → {String(c.newValue)} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
