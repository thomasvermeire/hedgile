import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import {
  changeRole,
  getOrganisation,
  inviteMember,
  LastAdminError,
  listMembers,
  memberInput,
  organisationInput,
  updateOrganisation,
} from '../settings/members.server.js';
import { getTestMode, setTestMode } from '../posting/test-mode.server.js';
import { ForbiddenError } from '../tenancy/tenant.js';
import { CardList } from '../ui/CardList';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings';

const currencyOptions = ['USD', 'EUR', 'GBP', 'CHF', 'CNY', 'JPY', 'IDR', 'AUD', 'CAD'].map(
  (c) => ({
    value: c,
    label: c,
  })
);
const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

export function meta() {
  return [{ title: 'Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const members = await listMembers(tenant);
  const editId = url.searchParams.get('member');
  const editing = editId ? (members.find((m) => m.id === editId) ?? null) : null;
  if (editId && !editing) throw data('Not found', { status: 404 });
  return {
    organisation: await getOrganisation(tenant),
    testMode: await getTestMode(tenant),
    members,
    isAdmin: tenant.role === 'admin',
    editing,
    inviting: url.searchParams.has('invite'),
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const intent = form.get('intent');
  try {
    if (intent === 'organisation') {
      const parsed = parseForm(organisationInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      await updateOrganisation(tenant, parsed.data);
    } else if (intent === 'test-mode') {
      await setTestMode(tenant, form.get('testMode') === 'on');
    } else if (intent === 'invite') {
      const parsed = parseForm(memberInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      await inviteMember(tenant, parsed.data);
    } else if (intent === 'role') {
      const role = form.get('role');
      const id = form.get('id');
      if ((role !== 'admin' && role !== 'user') || typeof id !== 'string') {
        return data({ errors: { role: 'Choose a role' } }, { status: 400 });
      }
      if (!(await changeRole(tenant, id, role))) throw data('Not found', { status: 404 });
    } else {
      throw data('Unknown action', { status: 400 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof LastAdminError)
      return data({ errors: { role: error.message } }, { status: 400 });
    throw error;
  }
  return redirect('/settings');
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { organisation, testMode, members, isAdmin, editing, inviting } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';

  return (
    <>
      <h1>Settings</h1>
      <section className="panel-form">
        <h2>Organisation</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="organisation" />
          <fieldset disabled={!isAdmin || busy}>
            <Field
              label="Name"
              name="name"
              defaultValue={organisation.name}
              error={errors.name}
              required
            />
            <Combobox
              label="Base currency"
              name="baseCurrency"
              options={currencyOptions}
              defaultValue={organisation.baseCurrency}
              required
            />
            {errors.baseCurrency && <p className="field__error">{errors.baseCurrency}</p>}
            {isAdmin && (
              <div className="form-actions">
                <button type="submit" className="button button--primary">
                  Save
                </button>
              </div>
            )}
          </fieldset>
        </Form>
        <Form method="post">
          <input type="hidden" name="intent" value="test-mode" />
          <fieldset disabled={!isAdmin || busy}>
            <label className="switch">
              <input type="checkbox" name="testMode" defaultChecked={testMode} role="switch" />
              Test mode
            </label>
            <p className="muted">
              In test mode, posting dates may be in the future. Leave it off for real bookkeeping.
            </p>
            {isAdmin && (
              <div className="form-actions">
                <button type="submit" className="button">
                  Save test mode
                </button>
              </div>
            )}
          </fieldset>
        </Form>
      </section>

      <div className={editing || inviting ? 'split' : undefined}>
        <CardList
          title="Members"
          createTo={isAdmin ? '?invite' : undefined}
          createLabel="Invite member"
          items={members.map((m) => ({
            id: m.id,
            title: m.name ?? m.email,
            subtitle: `${m.email} · ${m.role}${m.pending ? ' · invited' : ''}`,
            editTo: isAdmin ? `?member=${m.id}` : undefined,
          }))}
        />
        {isAdmin && inviting && (
          <Form method="post" className="panel-form">
            <h2>Invite a member</h2>
            <p className="muted">
              They join when they first sign in with LaimonID using this email address.
            </p>
            <input type="hidden" name="intent" value="invite" />
            <Field label="Email" name="email" type="email" error={errors.email} required />
            <Combobox label="Role" name="role" options={roleOptions} defaultValue="user" required />
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Invite
              </button>
              <Link to="/settings" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
        {isAdmin && editing && (
          <Form method="post" className="panel-form" key={editing.id}>
            <h2>{editing.name ?? editing.email}</h2>
            <input type="hidden" name="intent" value="role" />
            <input type="hidden" name="id" value={editing.id} />
            <Combobox
              label="Role"
              name="role"
              options={roleOptions}
              defaultValue={editing.role}
              required
            />
            {errors.role && <p className="field__error">{errors.role}</p>}
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Save
              </button>
              <Link to="/settings" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
