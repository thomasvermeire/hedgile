import { Bot, FileUp, Send, X } from 'lucide-react';
import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { extractionKinds } from './kinds';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Something went wrong (${res.status})`;
}

/** The Laimon side panel: chat, or drop a PDF to get a draft to check. */
export function LaimonPanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [kind, setKind] = useState('company');
  const [busy, setBusy] = useState<null | 'chat' | 'reading'>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setError(null);
    setBusy('chat');
    try {
      const res = await fetch('/api/laimon/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, messages: next.slice(-30) }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const { reply } = (await res.json()) as { reply: string };
      setTurns([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTurns(turns);
      setInput(text);
    } finally {
      setBusy(null);
    }
  }

  async function read(file: File) {
    if (busy) return;
    setError(null);
    setBusy('reading');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('kind', kind);
      const res = await fetch('/api/laimon/extract', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await errorText(res));
      const { draftUrl } = (await res.json()) as { draftUrl: string };
      navigate(draftUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void read(file);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="laimon-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open Laimon"
      >
        <Bot aria-hidden="true" size={20} />
        <span>Laimon</span>
      </button>
    );
  }

  return (
    <aside className="laimon" aria-label="Laimon">
      <header className="laimon__header">
        <Bot aria-hidden="true" size={18} />
        <h2>Laimon</h2>
        <button
          type="button"
          className="icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close Laimon"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>

      {!enabled ? (
        <p className="laimon__off">
          Laimon is switched off in this environment (no ANTHROPIC_API_KEY is set).
        </p>
      ) : (
        <>
          <div
            className={dragging ? 'dropzone is-dragging' : 'dropzone'}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <FileUp aria-hidden="true" size={20} />
            <p>{busy === 'reading' ? 'Laimon is reading the document…' : 'Drop a PDF here'}</p>
            <label className="dropzone__kind">
              Read as
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                disabled={busy !== null}
              >
                {Object.values(extractionKinds).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy !== null}
            >
              Choose a PDF
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void read(file);
              }}
            />
          </div>

          <ol className="laimon__messages" aria-live="polite">
            {turns.map((turn, i) => (
              <li key={i} className={`bubble bubble--${turn.role}`}>
                {turn.content}
              </li>
            ))}
            {busy === 'chat' && <li className="bubble bubble--assistant muted">Thinking…</li>}
          </ol>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <form className="laimon__input" onSubmit={send}>
            <label htmlFor="laimon-input" className="visually-hidden">
              Ask Laimon
            </label>
            <textarea
              id="laimon-input"
              rows={2}
              value={input}
              maxLength={4000}
              placeholder="Ask Laimon…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className="icon-button icon-button--primary"
              aria-label="Send"
              disabled={busy !== null}
            >
              <Send aria-hidden="true" size={16} />
            </button>
          </form>
        </>
      )}
    </aside>
  );
}
