import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import {
  addReference,
  createMetal,
  deleteMetal,
  DuplicateError,
  getMetalReference,
  listMetals,
  MetalInUseError,
  metalInput,
  metalRenameInput,
  referenceInput,
  renameMetal,
  updateReference,
} from '../markets/markets.server.js';
import { sourceTypeOptions } from '../markets/markets';
import { MetalList } from '../markets/MetalList';
import { ForbiddenError } from '../tenancy/tenant.js';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings.markets';

export function meta() {
  return [{ title: 'Markets · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const metals = await listMetals(tenant);
  const metalId = url.searchParams.get('metal');
  const referenceId = url.searchParams.get('reference');
  const addReferenceId = url.searchParams.get('addReference');
  const editingMetal = metalId ? (metals.find((m) => m.id === metalId) ?? null) : null;
  const editingReference = referenceId ? await getMetalReference(tenant, referenceId) : null;
  const referenceMetal = addReferenceId
    ? (metals.find((m) => m.id === addReferenceId) ?? null)
    : null;
  if (
    (metalId && !editingMetal) ||
    (referenceId && !editingReference) ||
    (addReferenceId && !referenceMetal)
  ) {
    throw data('Not found', { status: 404 });
  }
  return {
    metals,
    isAdmin: tenant.role === 'admin',
    creating: url.searchParams.has('new'),
    editingMetal,
    editingReference,
    referenceMetal,
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const intent = form.get('intent');
  const id = form.get('id');
  try {
    if (intent === 'create-metal') {
      const parsed = parseForm(metalInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      await createMetal(tenant, parsed.data);
    } else if (intent === 'rename-metal') {
      const parsed = parseForm(metalRenameInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      if (typeof id !== 'string' || !(await renameMetal(tenant, id, parsed.data.name))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'delete-metal') {
      if (typeof id !== 'string' || !(await deleteMetal(tenant, id))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'save-reference') {
      const parsed = parseForm(referenceInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      const metalId = form.get('metalId');
      if (typeof id === 'string' && id) {
        if (!(await updateReference(tenant, id, parsed.data))) {
          throw data('Not found', { status: 404 });
        }
      } else if (
        typeof metalId !== 'string' ||
        !(await addReference(tenant, metalId, parsed.data))
      ) {
        throw data('Not found', { status: 404 });
      }
    } else {
      throw data('Unknown action', { status: 400 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof MetalInUseError) {
      return data({ errors: { delete: error.message } }, { status: 400 });
    }
    if (error instanceof DuplicateError) {
      return data({ errors: { [error.field]: error.message } }, { status: 400 });
    }
    throw error;
  }
  return redirect('/settings/markets');
}

export default function Markets({ loaderData, actionData }: Route.ComponentProps) {
  const { metals, isAdmin, creating, editingMetal, editingReference, referenceMetal } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  const showPanel = isAdmin && (creating || editingMetal || editingReference || referenceMetal);

  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Markets</h1>
      <p className="muted">
        Book metals are the ones Hedgile keeps books for; market-only metals are followed in the
        market without books. Each metal has one or more price references with a source.
      </p>
      <div className={showPanel ? 'split' : undefined}>
        <MetalList metals={metals} canEdit={isAdmin} />
        {isAdmin && creating && (
          <Form method="post" className="panel-form">
            <h2>New market-only metal</h2>
            <input type="hidden" name="intent" value="create-metal" />
            <Field label="Symbol" name="symbol" error={errors.symbol} placeholder="Zn" required />
            <Field label="Name" name="name" error={errors.name} required />
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Add
              </button>
              <Link to="/settings/markets" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
        {isAdmin && editingMetal && (
          <div key={editingMetal.id}>
            <Form method="post" className="panel-form">
              <h2>
                {editingMetal.symbol} · {editingMetal.name}
              </h2>
              <input type="hidden" name="intent" value="rename-metal" />
              <input type="hidden" name="id" value={editingMetal.id} />
              <Field
                label="Name"
                name="name"
                defaultValue={editingMetal.name}
                error={errors.name}
                required
              />
              <div className="form-actions">
                <button type="submit" className="button button--primary" disabled={busy}>
                  Save
                </button>
                <Link to="/settings/markets" className="button">
                  Cancel
                </Link>
              </div>
            </Form>
            <Form method="post" className="panel-form">
              <h2>Delete metal</h2>
              <p className="muted">
                A metal that is a book metal or has active references cannot be deleted.
              </p>
              <input type="hidden" name="intent" value="delete-metal" />
              <input type="hidden" name="id" value={editingMetal.id} />
              {errors.delete && (
                <p className="field__error" role="alert">
                  {errors.delete}
                </p>
              )}
              <div className="form-actions">
                <button type="submit" className="button" disabled={busy}>
                  Delete {editingMetal.name}
                </button>
              </div>
            </Form>
          </div>
        )}
        {isAdmin && (editingReference || referenceMetal) && (
          <Form
            method="post"
            className="panel-form"
            key={editingReference?.id ?? referenceMetal?.id}
          >
            <h2>
              {editingReference
                ? `Edit ${editingReference.name}`
                : `New reference for ${referenceMetal?.name ?? ''}`}
            </h2>
            <input type="hidden" name="intent" value="save-reference" />
            {editingReference ? (
              <input type="hidden" name="id" value={editingReference.id} />
            ) : (
              <input type="hidden" name="metalId" value={referenceMetal?.id} />
            )}
            <Field
              label="Name"
              name="name"
              defaultValue={editingReference?.name}
              error={errors.name}
              required
            />
            <Field
              label="Publisher"
              name="source"
              defaultValue={editingReference?.source}
              error={errors.source}
              placeholder="LME"
              required
            />
            <Combobox
              label="Source"
              name="sourceType"
              options={sourceTypeOptions}
              defaultValue={editingReference?.sourceType ?? 'manual'}
              required
            />
            {errors.sourceType && <p className="field__error">{errors.sourceType}</p>}
            <label className="switch">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editingReference?.active ?? true}
                role="switch"
              />
              Active
            </label>
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Save
              </button>
              <Link to="/settings/markets" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
