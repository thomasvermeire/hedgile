import { data, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { CurrencyCards } from '../currencies/CurrencyCards';
import {
  getCurrencies,
  reportingCurrencyInput,
  setReportingCurrency,
} from '../currencies/currencies.server.js';
import { ForbiddenError } from '../tenancy/tenant.js';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings.currencies';

export function meta() {
  return [{ title: 'Currencies · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const { baseCurrency, entities } = await getCurrencies(tenant);
  const editId = new URL(args.request.url).searchParams.get('edit');
  return {
    baseCurrency,
    entities,
    canEdit: tenant.role === 'admin',
    editingId: editId && entities.some((e) => e.id === editId) ? editId : null,
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const parsed = parseForm(reportingCurrencyInput, await args.request.formData());
  if (!parsed.ok)
    return data(
      { error: parsed.errors.reportingCurrency ?? parsed.errors.companyId ?? 'Check the input' },
      { status: 400 }
    );
  try {
    if (!(await setReportingCurrency(tenant, parsed.data)))
      throw data('Not found', { status: 404 });
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    throw error;
  }
  return redirect('/settings/currencies');
}

export default function Currencies({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === 'submitting';
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Currencies</h1>
      <CurrencyCards {...loaderData} error={actionData?.error} busy={busy} />
    </>
  );
}
