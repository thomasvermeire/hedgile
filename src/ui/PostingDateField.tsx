import { useId } from 'react';
import { today } from '../posting/dates';

interface PostingDateFieldProps {
  testMode: boolean;
  name?: string;
  label?: string;
  defaultValue?: string;
  error?: string;
  /** Today's date (YYYY-MM-DD); only for tests. */
  todayDate?: string;
}

/** Date input for a posting date: defaults to today, no future dates unless test mode. */
export function PostingDateField({
  testMode,
  name = 'postingDate',
  label = 'Posting date',
  defaultValue,
  error,
  todayDate,
}: PostingDateFieldProps) {
  const id = useId();
  const now = todayDate ?? today();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="date"
        defaultValue={defaultValue ?? now}
        max={testMode ? undefined : now}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
