import { Pencil } from 'lucide-react';
import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { listAttachments } from '../master-data/attachments.server.js';
import {
  companyInput,
  createCompany,
  getCompany,
  listCompanies,
  stockValuationMethodOptions,
  updateCompany,
} from '../master-data/companies.server.js';
import { CardList } from '../ui/CardList';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { Lock } from '../ui/Lock';
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
  const [companies, attachments, orgBaseCurrency] = await Promise.all([
    listCompanies(tenant),
    listAttachments(tenant, 'company'),
    tenant.db
      .prepare('SELECT base_currency FROM organisations WHERE id = ?')
      .bind(tenant.organisationId)
      .first<{ base_currency: string }>(),
  ]);
  return {
    companies,
    attachments: attachments.map((a) => ({ id: a.id, objectId: a.objectId, filename: a.filename })),
    editing,
    creating: url.searchParams.has('new'),
    baseCurrency: orgBaseCurrency?.base_currency ?? 'USD',
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
  const { companies, attachments, editing, creating, baseCurrency } = loaderData;
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
              <div className="company-card">
                {c.legalName && <p><strong>Legal:</strong> {c.legalName}</p>}
                {c.commercialName && <p><strong>Commercial:</strong> {c.commercialName}</p>}
                {c.registrationNumber && <p><strong>Reg #:</strong> {c.registrationNumber}</p>}
                {c.addressLine1 && <p>{[c.addressLine1, c.addressLine2].filter(Boolean).join(', ')}</p>}
                {c.city && <p>{[c.city, c.postalCode, c.stateProvince].filter(Boolean).join(', ')}</p>}
                {c.website && <p><a href={c.website} target="_blank" rel="noreferrer">Website</a></p>}
                {c.contactPerson && (
                  <p>
                    <strong>Contact:</strong> {c.contactPerson}
                    {c.contactEmail && ` (${c.contactEmail})`}
                    {c.contactPhone && ` ${c.contactPhone}`}
                  </p>
                )}
                {c.stockValuationMethod && <p><strong>Valuation:</strong> {c.stockValuationMethod}</p>}
                <p>
                  <strong>Base currency:</strong> {baseCurrency} 
                  <Link to="/settings" className="lock-link" aria-label="View currencies in Settings">
                    <Lock />
                  </Link>
                </p>
                {c.reportingCurrency && (
                  <p>
                    <strong>Reporting currency:</strong> {c.reportingCurrency} 
                    <Link to={`?edit=${c.id}`} className="pencil-link" aria-label="Edit reporting currency">
                      <Pencil size={14} />
                    </Link>
                  </p>
                )}
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
              </div>
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
              label="Legal name"
              name="legalName"
              defaultValue={editing?.legalName}
              error={errors.legalName}
            />
            <Field
              label="Commercial name"
              name="commercialName"
              defaultValue={editing?.commercialName}
              error={errors.commercialName}
            />
            <Field
              label="Country (two letters)"
              name="country"
              defaultValue={editing?.country}
              error={errors.country}
              placeholder="HK"
            />
            <Field
              label="VAT number"
              name="vatNumber"
              defaultValue={editing?.vatNumber}
              error={errors.vatNumber}
            />
            <Field
              label="Registration number"
              name="registrationNumber"
              defaultValue={editing?.registrationNumber}
              error={errors.registrationNumber}
            />
            <Field
              label="Address line 1"
              name="addressLine1"
              defaultValue={editing?.addressLine1}
              error={errors.addressLine1}
            />
            <Field
              label="Address line 2"
              name="addressLine2"
              defaultValue={editing?.addressLine2}
              error={errors.addressLine2}
            />
            <Field
              label="City"
              name="city"
              defaultValue={editing?.city}
              error={errors.city}
            />
            <Field
              label="Postal code"
              name="postalCode"
              defaultValue={editing?.postalCode}
              error={errors.postalCode}
            />
            <Field
              label="State/Province"
              name="stateProvince"
              defaultValue={editing?.stateProvince}
              error={errors.stateProvince}
            />
            <Field
              label="Website"
              name="website"
              defaultValue={editing?.website}
              error={errors.website}
            />
            <Field
              label="Contact person"
              name="contactPerson"
              defaultValue={editing?.contactPerson}
              error={errors.contactPerson}
            />
            <Field
              label="Contact email"
              name="contactEmail"
              defaultValue={editing?.contactEmail}
              error={errors.contactEmail}
            />
            <Field
              label="Contact phone"
              name="contactPhone"
              defaultValue={editing?.contactPhone}
              error={errors.contactPhone}
            />
            <Combobox
              label="Stock valuation method"
              name="stockValuationMethod"
              options={stockValuationMethodOptions.map((v) => ({ value: v, label: v }))}
              defaultValue={editing?.stockValuationMethod ?? undefined}
            />
            {errors.stockValuationMethod && <p className="field__error">{errors.stockValuationMethod}</p>}
            <Field
              label="Reporting currency"
              name="reportingCurrency"
              defaultValue={editing?.reportingCurrency}
              error={errors.reportingCurrency}
              placeholder="USD"
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
