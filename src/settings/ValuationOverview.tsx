import { Lock } from '../ui/Lock';
import type { CompanyValuation } from './valuation.server';

/** Stock valuation per legal entity, read-only (type-only import of the server module). */
export function ValuationOverview({ valuations }: { valuations: CompanyValuation[] }) {
  return (
    <section className="locked-card" aria-label="Stock valuation">
      <header className="locked-card__header">
        <h2>Stock valuation</h2>
        <Lock label="Stock valuation is read-only here" />
      </header>
      <p className="muted">
        The method each legal entity values its stock with. It is set on the company in Master Data
        and cannot be changed here yet.
      </p>
      {valuations.length === 0 ? (
        <p className="muted">No legal entities yet.</p>
      ) : (
        <ul className="card-list__grid">
          {valuations.map((v) => (
            <li key={v.id} className="card">
              <div className="card__body">
                <h3 className="card__title">{v.name}</h3>
                <p className="card__subtitle">
                  Stock valuation method: <strong>{v.method ?? 'Not set'}</strong>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
