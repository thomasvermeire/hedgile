import { Pencil } from 'lucide-react';
import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import {
  activateMetal,
  addPeriod,
  BooksError,
  listBookMetals,
  periodInput,
  setBaseUnits,
  unitsInput,
  updatePeriod,
} from '../books/books.server.js';
import { MetalCard } from '../books/MetalCard';
import { isPastPeriod, type PeriodDraft } from '../books/periods';
import { PeriodicTable } from '../books/PeriodicTable';
import { today } from '../posting/dates';
import { ForbiddenError } from '../tenancy/tenant.js';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings.books';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function meta() {
  return [{ title: 'Books · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const metals = await listBookMetals(tenant);
  const periodId = url.searchParams.get('period');
  const addFor = url.searchParams.get('add');
  const editing = periodId
    ? (metals
        .flatMap((m) => m.periods.map((p) => ({ metal: m, period: p })))
        .find((x) => x.period.id === periodId) ?? null)
    : null;
  if (periodId && !editing) throw data('Not found', { status: 404 });
  const adding = addFor ? (metals.find((m) => m.id === addFor) ?? null) : null;
  if (addFor && !adding) throw data('Not found', { status: 404 });
  return {
    metals,
    today: today(),
    isAdmin: tenant.role === 'admin',
    picking: url.searchParams.has('pick'),
    editing: editing && {
      metalName: editing.metal.name,
      period: editing.period,
      locked: isPastPeriod(editing.period, today()),
    },
    adding: adding && { id: adding.id, name: adding.name },
  };
}

function draftOf(
  form: FormData
): { ok: true; draft: PeriodDraft } | { ok: false; errors: Record<string, string | undefined> } {
  const parsed = parseForm(periodInput, form);
  if (!parsed.ok) return parsed;
  return { ok: true, draft: parsed.data };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const intent = form.get('intent');
  const id = form.get('id');
  try {
    if (intent === 'activate') {
      const symbol = form.get('symbol');
      if (typeof symbol !== 'string') throw new BooksError('Choose a metal', 'symbol');
      await activateMetal(tenant, symbol);
    } else if (intent === 'units') {
      const parsed = parseForm(unitsInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      if (typeof id !== 'string' || !(await setBaseUnits(tenant, id, parsed.data))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'period-add' || intent === 'period-update') {
      const draft = draftOf(form);
      if (!draft.ok) return data({ errors: draft.errors }, { status: 400 });
      const found =
        typeof id === 'string' &&
        (intent === 'period-add'
          ? await addPeriod(tenant, id, draft.draft)
          : await updatePeriod(tenant, id, draft.draft));
      if (!found) throw data('Not found', { status: 404 });
    } else {
      throw data('Unknown action', { status: 400 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof BooksError) {
      return data({ errors: { [error.field]: error.message } }, { status: 400 });
    }
    throw error;
  }
  return redirect('/settings/books');
}

export default function Books({ loaderData, actionData }: Route.ComponentProps) {
  const { metals, today: todayDate, isAdmin, picking, editing, adding } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  const panel = editing ?? adding;
  const pageError = errors.symbol ?? errors.form ?? errors.baseUom ?? errors.baseCurrency;

  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Books</h1>
      <section className="card-list" aria-label="Active metals">
        <header className="card-list__header">
          <h2>Active metals</h2>
          {isAdmin && (
            <Link
              to={picking ? '/settings/books' : '?pick'}
              className="icon-button"
              aria-label={picking ? 'Close the periodic table' : 'Choose metals'}
              title={picking ? 'Close the periodic table' : 'Choose metals'}
            >
              <Pencil aria-hidden="true" size={16} />
            </Link>
          )}
        </header>
        {pageError && (
          <p className="field__error" role="alert">
            {pageError}
          </p>
        )}
        {picking && isAdmin && (
          <Form method="post" className="panel-form books__picker">
            <input type="hidden" name="intent" value="activate" />
            <h3>Click a metal to activate it</h3>
            <p className="muted">
              Activating starts today and runs indefinitely. Non-metals cannot be chosen.
            </p>
            <PeriodicTable
              activeSymbols={metals.filter((m) => m.activeToday).map((m) => m.symbol)}
              disabled={busy}
            />
          </Form>
        )}
        {metals.length === 0 ? (
          <p className="muted">
            No metals yet.{isAdmin ? ' Use the pencil to pick one from the periodic table.' : ''}
          </p>
        ) : (
          <ul className="card-list__grid">
            {metals.map((m) => (
              <MetalCard key={m.id} metal={m} today={todayDate} isAdmin={isAdmin} busy={busy} />
            ))}
          </ul>
        )}
      </section>
      {panel && isAdmin && (
        <Form method="post" className="panel-form" key={editing?.period.id ?? adding?.id}>
          <h2>
            {editing ? `Edit ${editing.metalName} period` : `Add a period to ${adding?.name ?? ''}`}
          </h2>
          <input type="hidden" name="intent" value={editing ? 'period-update' : 'period-add'} />
          <input type="hidden" name="id" value={editing ? editing.period.id : adding?.id} />
          {editing?.locked ? (
            <>
              <input type="hidden" name="status" value={editing.period.status} />
              <p className="muted">
                This period has ended: its status ({editing.period.status}) can no longer change.
              </p>
            </>
          ) : (
            <Combobox
              label="Status"
              name="status"
              options={statusOptions}
              defaultValue={editing?.period.status ?? 'active'}
              required
            />
          )}
          {errors.status && <p className="field__error">{errors.status}</p>}
          <Field
            label="From"
            name="validFrom"
            type="date"
            defaultValue={editing?.period.validFrom ?? todayDate}
            error={errors.validFrom}
            required
          />
          <Field
            label="To (empty = open-ended)"
            name="validTo"
            type="date"
            defaultValue={editing?.period.validTo}
            error={errors.validTo}
          />
          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={busy}>
              Save
            </button>
            <Link to="/settings/books" className="button">
              Cancel
            </Link>
          </div>
        </Form>
      )}
    </>
  );
}
