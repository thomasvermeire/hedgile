import { Pencil, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { sourceTypeLabels, type MetalView } from './markets';

interface MetalListProps {
  metals: MetalView[];
  /** Admins get the plus and pencils; others read only. */
  canEdit: boolean;
}

/** Metals as cards: book metals and market-only metals look different. */
export function MetalList({ metals, canEdit }: MetalListProps) {
  return (
    <section className="card-list" aria-label="Metals">
      <header className="card-list__header">
        <h2>Metals</h2>
        {canEdit && (
          <Link
            to="?new"
            className="icon-button icon-button--primary"
            aria-label="Add market-only metal"
            title="Add market-only metal"
          >
            <Plus aria-hidden="true" size={18} />
          </Link>
        )}
      </header>
      {metals.length === 0 ? (
        <p className="muted">No metals yet.</p>
      ) : (
        <ul className="card-list__grid">
          {metals.map((metal) => (
            <li
              key={metal.id}
              className={`card metal-card ${metal.isBook ? 'metal-card--book' : 'metal-card--market'}`}
              data-kind={metal.isBook ? 'book' : 'market'}
            >
              <div className="card__body">
                <h3 className="card__title">
                  <span className="metal-card__symbol">{metal.symbol}</span> {metal.name}
                </h3>
                <p className="card__subtitle">
                  <span className={`badge ${metal.isBook ? 'badge--book' : 'badge--market'}`}>
                    {metal.isBook ? 'Book metal' : 'Market only'}
                  </span>
                </p>
                <ul className="metal-card__references" aria-label={`References of ${metal.name}`}>
                  {metal.references.length === 0 && <li className="muted">No references yet.</li>}
                  {metal.references.map((ref) => (
                    <li key={ref.id} className={ref.active ? undefined : 'is-inactive'}>
                      <span className="metal-card__reference-name">{ref.name}</span>
                      <span className="muted">
                        {' '}
                        · {sourceTypeLabels[ref.sourceType]} · {ref.source}
                        {ref.active ? '' : ' · inactive'}
                      </span>
                      {canEdit && (
                        <Link
                          to={`?reference=${ref.id}`}
                          className="icon-button"
                          aria-label={`Edit ${ref.name}`}
                          title={`Edit ${ref.name}`}
                        >
                          <Pencil aria-hidden="true" size={14} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <Link to={`?addReference=${metal.id}`} className="metal-card__add">
                    Add reference
                  </Link>
                )}
              </div>
              {canEdit && (
                <Link
                  to={`?metal=${metal.id}`}
                  className="icon-button"
                  aria-label={`Edit ${metal.name}`}
                  title={`Edit ${metal.name}`}
                >
                  <Pencil aria-hidden="true" size={16} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
