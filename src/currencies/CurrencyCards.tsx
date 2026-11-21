import { Pencil } from 'lucide-react';
import { Form, Link } from 'react-router';
import { Combobox } from '../ui/Combobox';
import { Lock } from '../ui/Lock';
import { currencyOptions, effectiveReportingCurrency } from './currencies';
import { ReportingCurrencyValue } from './ReportingCurrencyValue';

export interface CurrencyEntity {
  id: string;
  name: string;
  baseCurrency: string;
  reportingCurrency: string | null;
}

const LOCK_TEXT = 'The base currency is the same for the whole organisation and cannot be changed';

/** The organisation's base currency (locked) and one card per legal entity. */
export function CurrencyCards({
  baseCurrency,
  entities,
  editingId,
  canEdit,
  error,
  busy = false,
}: {
  baseCurrency: string;
  entities: CurrencyEntity[];
  editingId: string | null;
  canEdit: boolean;
  error?: string;
  busy?: boolean;
}) {
  return (
    <>
      <section className="currencies__org" aria-label="Organisation base currency">
        <h2>Base currency</h2>
        <p className="inline-actions">
          <strong>{baseCurrency}</strong>
          <Lock label={LOCK_TEXT} />
        </p>
        <p className="muted">One base currency for the whole organisation.</p>
      </section>
      <section className="card-list" aria-label="Legal entities">
        <header className="card-list__header">
          <h2>Legal entities</h2>
        </header>
        {entities.length === 0 ? (
          <p className="muted">No legal entities yet. Add one under Master Data &gt; Companies.</p>
        ) : (
          <ul className="card-list__grid">
            {entities.map((entity) => (
              <li key={entity.id} className="card">
                <div className="card__body">
                  <h3 className="card__title">{entity.name}</h3>
                  <dl className="details">
                    <div className="detail">
                      <dt>Base currency</dt>
                      <dd>
                        <span className="inline-actions">
                          {entity.baseCurrency}
                          <Lock label={LOCK_TEXT} />
                        </span>
                      </dd>
                    </div>
                    <div className="detail">
                      <dt>Reporting currency</dt>
                      <dd>
                        {editingId === entity.id && canEdit ? (
                          <Form method="post" className="currencies__edit">
                            <input type="hidden" name="companyId" value={entity.id} />
                            <Combobox
                              label={`Reporting currency of ${entity.name}`}
                              name="reportingCurrency"
                              options={currencyOptions}
                              defaultValue={effectiveReportingCurrency(entity).code}
                            />
                            {error && <p className="field__error">{error}</p>}
                            <div className="form-actions">
                              <button
                                type="submit"
                                className="button button--primary"
                                disabled={busy}
                              >
                                Save
                              </button>
                              <Link to="/settings/currencies" className="button">
                                Cancel
                              </Link>
                            </div>
                          </Form>
                        ) : (
                          <span className="inline-actions">
                            <ReportingCurrencyValue company={entity} />
                            {canEdit && (
                              <Link
                                to={`?edit=${entity.id}`}
                                className="icon-link"
                                aria-label={`Edit reporting currency of ${entity.name}`}
                                title="Edit reporting currency"
                              >
                                <Pencil aria-hidden="true" size={14} />
                              </Link>
                            )}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
