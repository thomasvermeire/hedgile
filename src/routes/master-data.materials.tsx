import { data, Form, Link, redirect, useNavigation } from 'react-router';
import { requireTenant } from '../auth/guard.server.js';
import {
  createMaterial,
  DuplicateCodeError,
  getMaterial,
  listMaterials,
  materialInput,
  updateMaterial,
} from '../master-data/materials.server.js';
import { metalOptions } from '../master-data/metals';
import { CardList } from '../ui/CardList';
import { Combobox } from '../ui/Combobox';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/master-data.materials';

export function meta() {
  return [{ title: 'Materials · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const url = new URL(args.request.url);
  const editId = url.searchParams.get('edit');
  const editing = editId ? await getMaterial(tenant, editId) : null;
  if (editId && !editing) throw data('Not found', { status: 404 });
  return { materials: await listMaterials(tenant), editing, creating: url.searchParams.has('new') };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const parsed = parseForm(materialInput, form);
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
  const id = form.get('id');
  try {
    if (typeof id === 'string' && id) {
      if (!(await updateMaterial(tenant, id, parsed.data)))
        throw data('Not found', { status: 404 });
    } else {
      await createMaterial(tenant, parsed.data);
    }
  } catch (error) {
    if (error instanceof DuplicateCodeError)
      return data({ errors: { code: error.message } }, { status: 400 });
    throw error;
  }
  return redirect('/master-data/materials');
}

export default function Materials({ loaderData, actionData }: Route.ComponentProps) {
  const { materials, editing, creating } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  const showForm = creating || editing;

  return (
    <>
      <p className="breadcrumb">Master Data</p>
      <h1>Materials</h1>
      <div className={showForm ? 'split' : undefined}>
        <CardList
          title="Materials"
          createTo="?new"
          createLabel="Create material"
          items={materials.map((m) => ({
            id: m.id,
            title: m.name,
            subtitle: `${m.code} · ${m.metal}`,
            editTo: `?edit=${m.id}`,
          }))}
        />
        {showForm && (
          <Form method="post" className="panel-form" key={editing?.id ?? 'new'}>
            <h2>{editing ? `Edit ${editing.name}` : 'New material'}</h2>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field
              label="Code"
              name="code"
              defaultValue={editing?.code}
              error={errors.code}
              required
            />
            <Field
              label="Name"
              name="name"
              defaultValue={editing?.name}
              error={errors.name}
              required
            />
            <Combobox
              label="Metal"
              name="metal"
              options={metalOptions}
              defaultValue={editing?.metal}
              placeholder="Type to search, e.g. kel"
              required
            />
            {errors.metal && <p className="field__error">{errors.metal}</p>}
            <div className="form-actions">
              <button type="submit" className="button button--primary" disabled={busy}>
                Save
              </button>
              <Link to="/master-data/materials" className="button">
                Cancel
              </Link>
            </div>
          </Form>
        )}
      </div>
    </>
  );
}
