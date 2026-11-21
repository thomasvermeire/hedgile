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
import { currencyOptions, effectiveReportingCurrency } from '../currencies/currencies';
import { stockValuationMethodOptions } from '../master-data/companies';
import { CompanyDetails } from '../master-data/CompanyDetails';
import { CardList } from '../ui/CardList';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { Lock } from '../ui/Lock';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/master-data.companies';

const valuationOptions = stockValuationMethodOptions.map((v) => ({ value: v, label: v }));

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
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
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
            subtitle:
              c.commercialName && c.commercialName !== c.name ? c.commercialName : undefined,
            details: (
              <CompanyDetails
                company={c}
                attachments={attachments.filter((a) => a.objectId === c.id)}
              />
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
            <fieldset className="form-group">
              <legend>Address</legend>
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
                label="Postal code"
                name="postalCode"
                defaultValue={editing?.postalCode}
                error={errors.postalCode}
              />
              <Field label="City" name="city" defaultValue={editing?.city} error={errors.city} />
              <Field
                label="State or region"
                name="stateProvince"
                defaultValue={editing?.stateProvince}
                error={errors.stateProvince}
              />
              <Field
                label="Country (two letters)"
                name="country"
                defaultValue={editing?.country}
                error={errors.country}
                placeholder="HK"
              />
              {editing?.address && <input type="hidden" name="address" value={editing.address} />}
            </fieldset>
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
              label="Website"
              name="website"
              defaultValue={editing?.website}
              error={errors.website}
            />
            <fieldset className="form-group">
              <legend>Contact</legend>
              <Field
                label="Contact person"
                name="contactPerson"
                defaultValue={editing?.contactPerson}
                error={errors.contactPerson}
              />
              <Field
                label="Contact email"
                name="contactEmail"
                type="email"
                defaultValue={editing?.contactEmail}
                error={errors.contactEmail}
              />
              <Field
                label="Contact phone"
                name="contactPhone"
                defaultValue={editing?.contactPhone}
                error={errors.contactPhone}
              />
            </fieldset>
            <Combobox
              label="Stock valuation method"
              name="stockValuationMethod"
              options={valuationOptions}
              defaultValue={editing?.stockValuationMethod ?? undefined}
            />
            {errors.stockValuationMethod && (
              <p className="field__error">{errors.stockValuationMethod}</p>
            )}
            <div className="field">
              <span className="field__label">Base currency</span>
              <p className="inline-actions">
                {editing?.baseCurrency ?? 'USD'}
                <Link
                  to="/settings/currencies"
                  className="icon-link"
                  title="Base currency is set in Settings > Currencies"
                >
                  <Lock label="Base currency is set in Settings > Currencies" />
                </Link>
              </p>
            </div>
            <Combobox
              label="Reporting currency"
              name="reportingCurrency"
              options={currencyOptions}
              defaultValue={editing ? effectiveReportingCurrency(editing).code : undefined}
            />
            {errors.reportingCurrency && <p className="field__error">{errors.reportingCurrency}</p>}
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
