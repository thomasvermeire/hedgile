import { useId } from 'react';

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}

export function Field({
  label,
  name,
  defaultValue,
  error,
  required,
  type = 'text',
  placeholder,
}: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder={placeholder}
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
