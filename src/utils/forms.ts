import type { z } from 'zod';

export type FieldErrors = Partial<Record<string, string>>;

export type FormResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Validate submitted form fields with a Zod schema; errors keyed by field name. */
export function parseForm<S extends z.ZodType>(schema: S, form: FormData): FormResult<z.infer<S>> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
