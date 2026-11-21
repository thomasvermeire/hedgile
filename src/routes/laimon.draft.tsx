import { Bot } from 'lucide-react';
import { data, Form, redirect, useNavigation } from 'react-router';
import { appEnv, requireTenant } from '../auth/guard.server.js';
import {
  confirmCompanyDraft,
  discardDraft,
  DraftClosedError,
  getDraft,
} from '../laimon/drafts.server.js';
import { confidenceLevel, extractionKinds } from '../laimon/kinds';
import { companyInput } from '../master-data/companies.server.js';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/laimon.draft';

export function meta() {
  return [{ title: 'Check what Laimon read · Hedgile' }];
}

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const draft = await getDraft(tenant, args.params.draftId);
  if (!draft) throw data('Not found', { status: 404 });
  const kind = extractionKinds[draft.kind];
  if (!kind) throw data('Unknown document kind', { status: 404 });
  return { draft, kindLabel: kind.label, fieldLabels: kind.fields };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const draftId = args.params.draftId;
  if (form.get('intent') === 'discard') {
    await discardDraft(tenant, appEnv(args.context).ATTACHMENTS, draftId);
    return redirect('/');
  }
  const parsed = parseForm(companyInput, form);
  if (!parsed.ok) return data({ errors: parsed.errors }, { status: 400 });
  try {
    await confirmCompanyDraft(tenant, draftId, parsed.data);
  } catch (error) {
    if (error instanceof DraftClosedError)
      return data({ errors: { form: error.message } }, { status: 409 });
    throw error;
  }
  return redirect('/master-data/companies');
}

export default function LaimonDraft({ loaderData, actionData }: Route.ComponentProps) {
  const { draft, kindLabel, fieldLabels } = loaderData;
  const errors: Partial<Record<string, string>> = actionData?.errors ?? {};
  const busy = useNavigation().state === 'submitting';
  const open = draft.status === 'draft';

  return (
    <>
      <p className="breadcrumb">
        <Bot aria-hidden="true" size={14} /> Laimon
      </p>
      <h1>Check what Laimon read</h1>
      <p className="muted">
        {kindLabel} · from <strong>{draft.filename}</strong>. Nothing is saved until you confirm.
      </p>
      {!open && <p className="notice">This draft was already {draft.status}.</p>}
      {errors.form && <p className="field__error">{errors.form}</p>}
      <Form method="post" className="panel-form draft">
        <fieldset disabled={!open || busy}>
          {Object.entries(fieldLabels).map(([name, label]) => {
            const field = draft.fields[name];
            const level = confidenceLevel(field?.confidence ?? 0);
            return (
              <div key={name} className="draft__field">
                <Field label={label} name={name} defaultValue={field?.value} error={errors[name]} />
                <p className="draft__meta">
                  <span className={`confidence confidence--${level}`}>
                    {field?.value == null
                      ? 'not found'
                      : `${level} confidence (${Math.round((field?.confidence ?? 0) * 100)}%)`}
                  </span>
                  {field?.evidence && <span className="draft__evidence">“{field.evidence}”</span>}
                </p>
              </div>
            );
          })}
          <div className="form-actions">
            <button type="submit" name="intent" value="confirm" className="button button--primary">
              Confirm and save
            </button>
            <button type="submit" name="intent" value="discard" className="button" formNoValidate>
              Discard
            </button>
          </div>
        </fieldset>
      </Form>
    </>
  );
}
