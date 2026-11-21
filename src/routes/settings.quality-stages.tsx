import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import { StageStatus } from '../quality/StageStatus';
import {
  addQualityStage,
  listQualityStages,
  newStageInput,
  setQualityStageActive,
  stageInput,
  StageCodeTakenError,
  StageLockedError,
  updateQualityStage,
} from '../quality/stages.server.js';
import { ForbiddenError } from '../tenancy/tenant.js';
import { CardList } from '../ui/CardList';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings.quality-stages';

export function meta() {
  return [{ title: 'Quality stages · Settings · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const stages = await listQualityStages(tenant);
  const editId = url.searchParams.get('edit');
  const editing = editId ? (stages.find((s) => s.id === editId) ?? null) : null;
  if (editId && !editing) throw data('Not found', { status: 404 });
  return {
    stages,
    isAdmin: tenant.role === 'admin',
    editing,
    adding: url.searchParams.has('new'),
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const intent = form.get('intent');
  const id = form.get('id');
  try {
    if (intent === 'add') {
      const parsed = parseForm(newStageInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      await addQualityStage(tenant, parsed.data);
    } else if (intent === 'edit') {
      const parsed = parseForm(stageInput, form);
      if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
      if (typeof id !== 'string' || !(await updateQualityStage(tenant, id, parsed.data))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'activate' || intent === 'deactivate') {
      const done =
        typeof id === 'string' && (await setQualityStageActive(tenant, id, intent === 'activate'));
      if (!done) throw data('Not found', { status: 404 });
    } else {
      throw data('Unknown action', { status: 400 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof StageCodeTakenError)
      return data({ errors: { code: error.message } }, { status: 400 });
    if (error instanceof StageLockedError)
      return data({ errors: { status: error.message } }, { status: 400 });
    throw error;
  }
  return redirect('/settings/quality-stages');
}

export default function QualityStages({ loaderData, actionData }: Route.ComponentProps) {
  const { stages, isAdmin, editing, adding } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';

  return (
    <>
      <h1>Quality stages</h1>
      {errors.status && <p className="field__error">{errors.status}</p>}
      <div className={editing || adding ? 'split' : undefined}>
        <CardList
          title="Stages"
          createTo={isAdmin ? '?new' : undefined}
          createLabel="Add quality stage"
          items={stages.map((s) => ({
            id: s.id,
            title: `${s.code} · ${s.name}`,
            subtitle: s.description ?? undefined,
            editTo: isAdmin ? `?edit=${s.id}` : undefined,
            details: (
              <div className="stage-details">
                <StageStatus status={s.status} />
                {isAdmin && s.status !== 'locked' && (
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={s.status === 'active' ? 'deactivate' : 'activate'}
                    />
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="button" disabled={busy}>
                      {s.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </Form>
                )}
              </div>
            ),
          }))}
        />
        {isAdmin && adding && (
          <Form method="post" className="panel-form">
            <h2>Add a quality stage</h2>
            <p className="muted">New stages start active.</p>
            <input type="hidden" name="intent" value="add" />
            <Field label="Code" name="code" placeholder="TA" error={errors.code} required />
            <Field label="Name" name="name" error={errors.name} required />
            <Field label="Description" name="description" error={errors.description} />
            <Field label="Order" name="sortOrder" type="number" error={errors.sortOrder} />
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Add
              </button>
              <Link to="/settings/quality-stages" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
        {isAdmin && editing && (
          <Form method="post" className="panel-form" key={editing.id}>
            <h2>
              {editing.code} · {editing.name}
            </h2>
            <input type="hidden" name="intent" value="edit" />
            <input type="hidden" name="id" value={editing.id} />
            <Field
              label="Name"
              name="name"
              defaultValue={editing.name}
              error={errors.name}
              required
            />
            <Field
              label="Description"
              name="description"
              defaultValue={editing.description}
              error={errors.description}
            />
            <Field
              label="Order"
              name="sortOrder"
              type="number"
              defaultValue={String(editing.sortOrder)}
              error={errors.sortOrder}
            />
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Save
              </button>
              <Link to="/settings/quality-stages" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
