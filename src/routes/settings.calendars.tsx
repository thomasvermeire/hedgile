import { data, Form, redirect, useNavigation } from 'react-router';
import { z } from 'zod';
import { requireTenant } from '../auth/guard.server.js';
import {
  addHoliday,
  holidayInput,
  HolidayExistsError,
  listCalendars,
  removeHoliday,
  setWeekdays,
  weekdaysInput,
} from '../calendars/calendars.server.js';
import { countPublicationDays, WEEKDAY_LABELS } from '../calendars/publication-days.js';
import { isIsoDate } from '../posting/dates.js';
import { ForbiddenError } from '../tenancy/tenant.js';
import { Field } from '../ui/Field';
import { parseForm } from '../utils/forms';
import type { Route } from './+types/settings.calendars';

export function meta() {
  return [{ title: 'Calendars · Settings · Hedgile' }];
}

const MAX_CHECK_DAYS = 3660;

const rangeInput = z
  .object({
    from: z.string().trim().refine(isIsoDate, 'Enter a valid date (YYYY-MM-DD)'),
    to: z.string().trim().refine(isIsoDate, 'Enter a valid date (YYYY-MM-DD)'),
  })
  .superRefine((value, ctx) => {
    if (!isIsoDate(value.from) || !isIsoDate(value.to)) return;
    if (value.from > value.to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'The end date is before the start' });
    } else if (Date.parse(value.to) - Date.parse(value.from) > MAX_CHECK_DAYS * 86_400_000) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Choose a range of at most 10 years' });
    }
  });

export async function loader(args: Route.LoaderArgs) {
  const tenant = await requireTenant(args);
  const calendars = await listCalendars(tenant);
  const url = new URL(args.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  let check: {
    from: string;
    to: string;
    counts: { referenceId: string; days: number }[];
  } | null = null;
  const checkErrors: Partial<Record<string, string>> = {};
  if (from !== null || to !== null) {
    const parsed = rangeInput.safeParse({ from: from ?? '', to: to ?? '' });
    if (parsed.success) {
      check = {
        ...parsed.data,
        counts: calendars.map((c) => ({
          referenceId: c.referenceId,
          days: countPublicationDays(c, parsed.data.from, parsed.data.to),
        })),
      };
    } else {
      for (const issue of parsed.error.issues) {
        checkErrors[String(issue.path[0])] ??= issue.message;
      }
    }
  }
  return {
    calendars,
    isAdmin: tenant.role === 'admin',
    from: from ?? '',
    to: to ?? '',
    check,
    checkErrors,
  };
}

export async function action(args: Route.ActionArgs) {
  const tenant = await requireTenant(args);
  const form = await args.request.formData();
  const intent = form.get('intent');
  const referenceId = form.get('referenceId');
  if (typeof referenceId !== 'string') throw data('Not found', { status: 404 });
  try {
    if (intent === 'weekdays') {
      const parsed = weekdaysInput.safeParse({ weekdays: form.getAll('weekday') });
      if (!parsed.success) {
        return data(
          { referenceId, errors: { weekdays: parsed.error.issues[0]?.message ?? 'Invalid' } },
          { status: 400 }
        );
      }
      if (!(await setWeekdays(tenant, referenceId, parsed.data))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'add-holiday') {
      const parsed = parseForm(holidayInput, form);
      if (!parsed.ok) return data({ referenceId, errors: parsed.errors }, { status: 400 });
      if (!(await addHoliday(tenant, referenceId, parsed.data))) {
        throw data('Not found', { status: 404 });
      }
    } else if (intent === 'remove-holiday') {
      const date = form.get('date');
      if (typeof date !== 'string' || !(await removeHoliday(tenant, referenceId, date))) {
        throw data('Not found', { status: 404 });
      }
    } else {
      throw data('Unknown action', { status: 400 });
    }
  } catch (error) {
    if (error instanceof ForbiddenError) throw data(error.message, { status: 403 });
    if (error instanceof HolidayExistsError) {
      return data({ referenceId, errors: { date: error.message } }, { status: 400 });
    }
    throw error;
  }
  return redirect('/settings/calendars');
}

export default function Calendars({ loaderData, actionData }: Route.ComponentProps) {
  const { calendars, isAdmin, from, to, check, checkErrors } = loaderData;
  const busy = useNavigation().state === 'submitting';
  const errorsFor = (referenceId: string): Partial<Record<string, string>> =>
    actionData?.referenceId === referenceId ? actionData.errors : {};

  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>Calendars</h1>
      <p className="muted">
        The weekdays on which each price source publishes, and its holidays. Splitting a hedge into
        daily lines uses these days.
      </p>

      <div className="calendars">
        {calendars.map((calendar) => {
          const errors = errorsFor(calendar.referenceId);
          return (
            <section
              key={calendar.referenceId}
              className="panel-form calendar"
              aria-label={calendar.referenceName}
            >
              <h2>{calendar.referenceName}</h2>
              <p className="muted">{calendar.metal}</p>

              <ul className="chips" aria-label={`Publishing weekdays of ${calendar.referenceName}`}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <li
                    key={label}
                    className={
                      calendar.weekdays.includes(index + 1) ? 'chip chip--on' : 'chip chip--off'
                    }
                  >
                    {label}
                  </li>
                ))}
              </ul>

              {isAdmin && (
                <Form method="post" className="calendar__weekdays">
                  <input type="hidden" name="intent" value="weekdays" />
                  <input type="hidden" name="referenceId" value={calendar.referenceId} />
                  <fieldset disabled={busy}>
                    <legend>Publishes on</legend>
                    {WEEKDAY_LABELS.map((label, index) => (
                      <label key={label} className="calendar__weekday">
                        <input
                          type="checkbox"
                          name="weekday"
                          value={index + 1}
                          defaultChecked={calendar.weekdays.includes(index + 1)}
                        />
                        {label}
                      </label>
                    ))}
                    {errors.weekdays && <p className="field__error">{errors.weekdays}</p>}
                    <div className="form-actions">
                      <button type="submit" className="button button--primary">
                        Save weekdays
                      </button>
                    </div>
                  </fieldset>
                </Form>
              )}

              <h3>Holidays</h3>
              {calendar.holidayList.length === 0 ? (
                <p className="muted">No holidays.</p>
              ) : (
                <ul className="calendar__holidays">
                  {calendar.holidayList.map((holiday) => (
                    <li key={holiday.date}>
                      <span>
                        <time dateTime={holiday.date}>{holiday.date}</time>
                        {holiday.name && <span className="muted"> · {holiday.name}</span>}
                      </span>
                      {isAdmin && (
                        <Form method="post">
                          <input type="hidden" name="intent" value="remove-holiday" />
                          <input type="hidden" name="referenceId" value={calendar.referenceId} />
                          <input type="hidden" name="date" value={holiday.date} />
                          <button
                            type="submit"
                            className="button"
                            disabled={busy}
                            aria-label={`Remove holiday ${holiday.date} from ${calendar.referenceName}`}
                          >
                            Remove
                          </button>
                        </Form>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isAdmin && (
                <Form method="post" className="calendar__add">
                  <input type="hidden" name="intent" value="add-holiday" />
                  <input type="hidden" name="referenceId" value={calendar.referenceId} />
                  <fieldset disabled={busy}>
                    <legend>Add a holiday</legend>
                    <Field label="Date" name="date" type="date" error={errors.date} required />
                    <Field label="Name (optional)" name="name" error={errors.name} />
                    <div className="form-actions">
                      <button type="submit" className="button">
                        Add holiday
                      </button>
                    </div>
                  </fieldset>
                </Form>
              )}
            </section>
          );
        })}
      </div>

      <section className="panel-form calendar-check" aria-label="Publishing days checker">
        <h2>Publishing days between two dates</h2>
        <Form method="get">
          <Field
            label="From"
            name="from"
            type="date"
            defaultValue={from}
            error={checkErrors.from}
          />
          <Field label="To" name="to" type="date" defaultValue={to} error={checkErrors.to} />
          <div className="form-actions">
            <button type="submit" className="button button--primary">
              Count days
            </button>
          </div>
        </Form>
        {check && (
          <table className="calendar-check__result">
            <caption>
              {check.from} to {check.to}, both included
            </caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Publishing days</th>
              </tr>
            </thead>
            <tbody>
              {calendars.map((calendar) => (
                <tr key={calendar.referenceId}>
                  <th scope="row">{calendar.referenceName}</th>
                  <td>{check.counts.find((c) => c.referenceId === calendar.referenceId)?.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
