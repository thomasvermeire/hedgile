import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  renderCalculation,
  TRIGGER_LABELS,
  type ProvenanceRecord,
  type ProvenanceResult,
} from '../provenance/provenance';

interface Props {
  objectType: string;
  objectId: string;
  field: string;
  /** The figure as shown. */
  children: ReactNode;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: ProvenanceResult };

function who(record: ProvenanceRecord): string {
  if (record.mode === 'automatic' && !record.userId) return 'the system';
  return record.userName ?? record.userEmail ?? 'unknown user';
}

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function Calculation({ record }: { record: ProvenanceRecord }) {
  if (!record.formula) return null;
  return (
    <div className="provenance__calc">
      <p className="provenance__formula">
        {renderCalculation(record.formula, record.inputs ?? [], record.value)}
      </p>
      {record.inputs && record.inputs.length > 0 ? (
        <ul className="provenance__inputs">
          {record.inputs.map((input) => (
            <li key={input.name}>
              <strong>{input.name}</strong> {String(input.value)}
              {input.source ? <span className="muted"> ({input.source})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A figure that opens "Why this value": trigger, automatic or manual, who, when, the calculation. */
export function ProvenanceValue({ objectType, objectId, field, children }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'loading' });
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ objectType, objectId, field });
    fetch(`/api/provenance?${query.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) throw new Error('No provenance has been recorded for this value');
        if (!res.ok) throw new Error(`Could not load why this value (${res.status})`);
        return (await res.json()) as ProvenanceResult;
      })
      .then((result) => setState({ status: 'ready', result }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load why this value',
        });
      });
    return () => controller.abort();
  }, [open, objectType, objectId, field]);

  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  const latest = state.status === 'ready' ? state.result.latest : null;

  return (
    <span className="provenance" ref={root}>
      <button
        type="button"
        ref={button}
        className="provenance__figure"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setState({ status: 'loading' });
          setOpen(!open);
        }}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={dialog}
          className="provenance__popover"
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <h3 id={titleId}>Why this value</h3>
          {state.status === 'loading' ? <p role="status">Loading…</p> : null}
          {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
          {latest ? (
            <>
              <dl className="provenance__facts">
                <dt>Trigger</dt>
                <dd>{TRIGGER_LABELS[latest.trigger]}</dd>
                <dt>How</dt>
                <dd>{latest.mode === 'automatic' ? 'Automatic' : 'Manual'}</dd>
                <dt>Who</dt>
                <dd>{who(latest)}</dd>
                <dt>When</dt>
                <dd>
                  <time dateTime={latest.createdAt}>{when(latest.createdAt)}</time>
                </dd>
              </dl>
              <Calculation record={latest} />
              {state.status === 'ready' && state.result.history.length > 0 ? (
                <details className="provenance__history">
                  <summary>History ({state.result.history.length})</summary>
                  <ul>
                    {state.result.history.map((record) => (
                      <li key={record.id}>
                        {when(record.createdAt)}: {record.value} by {who(record)} (
                        {TRIGGER_LABELS[record.trigger].toLowerCase()}, {record.mode})
                        {record.formula
                          ? ` ${renderCalculation(record.formula, record.inputs ?? [], record.value)}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
          <button type="button" className="provenance__close" onClick={close}>
            Close
          </button>
        </div>
      ) : null}
    </span>
  );
}
