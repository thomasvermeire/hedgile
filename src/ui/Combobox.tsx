import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
}

/** Options whose label contains the query anywhere, ignoring case ("kel" finds Nickel). */
export function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

interface ComboboxProps {
  label: string;
  name: string;
  options: ComboboxOption[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

/**
 * A type-ahead dropdown: typing filters on any part of the value. Keyboard:
 * arrows move, Enter picks, Escape closes. Submits the chosen value as `name`.
 */
export function Combobox({
  label,
  name,
  options,
  defaultValue = '',
  required,
  placeholder,
  onChange,
}: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const initial = options.find((o) => o.value === defaultValue);
  const [value, setValue] = useState(initial?.value ?? '');
  const [query, setQuery] = useState(initial?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const matches = useMemo(
    () => filterOptions(options, query === selectedLabel ? '' : query),
    [options, query, selectedLabel]
  );

  function choose(option: ComboboxOption) {
    setValue(option.value);
    setQuery(option.label);
    setOpen(false);
    onChange?.(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && open) {
      const option = matches[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="field combobox">
      <label htmlFor={id}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        required={required}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (e.target.value === '') setValue('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          // Leaving with text that matches no option keeps the last valid choice.
          setQuery(options.find((o) => o.value === value)?.label ?? '');
        }}
        onKeyDown={onKeyDown}
      />
      <input type="hidden" name={name} value={value} />
      {open && (
        <ul className="combobox__list" id={listId} role="listbox" aria-label={label}>
          {matches.length === 0 && <li className="combobox__empty">No matches</li>}
          {matches.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={index === active ? 'combobox__option is-active' : 'combobox__option'}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
