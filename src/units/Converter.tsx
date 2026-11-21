import { useState } from 'react';
import { formatDecimal } from './format';
import { conversionInput, convertText, units, type Unit } from './units';

export function Converter() {
  const [quantity, setQuantity] = useState('49888.97413');
  const [from, setFrom] = useState<Unit>('lb');
  const [to, setTo] = useState<Unit>('kg');
  const parsed = conversionInput.safeParse({ quantity, from, to });
  const result = parsed.success
    ? formatDecimal(convertText(parsed.data), { trimZeros: true })
    : null;

  return (
    <form className="panel-form units-converter" onSubmit={(e) => e.preventDefault()}>
      <h2>Converter</h2>
      <div className="field">
        <label htmlFor="units-quantity">Quantity</label>
        <input
          id="units-quantity"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={parsed.success ? undefined : true}
        />
        {!parsed.success && (
          <p className="field__error">{parsed.error.issues[0]?.message ?? 'Invalid input'}</p>
        )}
      </div>
      <div className="field">
        <label htmlFor="units-from">From</label>
        <select id="units-from" value={from} onChange={(e) => setFrom(e.target.value as Unit)}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="units-to">To</label>
        <select id="units-to" value={to} onChange={(e) => setTo(e.target.value as Unit)}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <p className="units-result" aria-live="polite">
        {result !== null ? (
          <>
            <strong data-testid="units-result">{result}</strong> {to}
          </>
        ) : (
          '–'
        )}
      </p>
    </form>
  );
}
