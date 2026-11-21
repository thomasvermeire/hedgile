import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { listAttachments } from '../master-data/attachments.server.js';
import {
  companyInput,
  createCompany,
  getCompany,
  listCompanies,
  updateCompany,
} from '../master-data/companies.server.js';
import { CardList } from '../ui/CardList';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/master-data.companies';

export function meta() {
  return [{ title: 'Companies · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const editId = url.searchParams.get('edit');
  const editing = editId ? await getCompany(tenant, editId) : null;
  if (editId && !editing) throw data('Not found', { status: 404 });
  const [companies, attachments] = await Promise.all([
    listCompanies(tenant),
    listAttachments(tenant, 'company'),
  ]);
  return {
    companies,
    attachments: attachments.map((a) => ({ id: a.id, objectId: a.objectId, filename: a.filename })),
    editing,
    creating: url.searchParams.has('new'),
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const parsed = parseForm(companyInput, form);
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
  const id = form.get('id');
  if (typeof id === 'string' && id) {
    if (!(await updateCompany(tenant, id, parsed.data))) throw data('Not found', { status: 404 });
  } else {
    await createCompany(tenant, parsed.data);
  }
  return redirect('/master-data/companies');
}

export default function Companies({ loaderData, actionData }: Route.ComponentProps) {
  const { companies, attachments, editing, creating } = loaderData;
  const errors = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  const showForm = creating || editing;

  return (
    <>
      <p className="breadcrumb">Master Data</p>
      <h1>Companies</h1>
      <div className={showForm ? 'split' : undefined}>
        <CardList
          title="Companies"
          createTo="?new"
          createLabel="Create company"
          emptyText="No companies yet. Use the plus to add one, or drop a document on Laimon."
          items={companies.map((c) => ({
            id: c.id,
            title: c.name,
            subtitle: [c.country, c.vatNumber].filter(Boolean).join(' · ') || undefined,
            details: (
              <>
                {c.address && <p>{c.address}</p>}
                {attachments
                  .filter((a) => a.objectId === c.id)
                  .map((a) => (
                    <a
                      key={a.id}
                      href={`/attachments/${a.id}`}
                      className="attachment"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.filename}
                    </a>
                  ))}
              </>
            ),
            editTo: `?edit=${c.id}`,
          }))}
        />
        {showForm && (
          <Form method="post" className="panel-form" key={editing?.id ?? 'new'}>
            <h2>{editing ? `Edit ${editing.name}` : 'New company'}</h2>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field
              label="Name"
              name="name"
              defaultValue={editing?.name}
              error={errors.name}
              required
            />
            <Field
              label="Country (two letters)"
              name="country"
              defaultValue={editing?.country}
              error={errors.country}
              placeholder="NL"
            />
            <Field
              label="VAT number"
              name="vatNumber"
              defaultValue={editing?.vatNumber}
              error={errors.vatNumber}
            />
            <Field
              label="Address"
              name="address"
              defaultValue={editing?.address}
              error={errors.address}
            />
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Save
              </button>
              <Link to="/master-data/companies" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
