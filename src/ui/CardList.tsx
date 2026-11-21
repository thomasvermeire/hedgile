import { Pencil, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface CardItem {
  id: string;
  title: string;
  subtitle?: string;
  details?: ReactNode;
  /** Where the pencil goes; no pencil when absent (e.g. read-only users). */
  editTo?: string;
}

interface CardListProps {
  title: string;
  items: CardItem[];
  /** Where the plus goes; no plus when absent. */
  createTo?: string;
  createLabel?: string;
  emptyText?: string;
}

/** A list of cards: plus (create) in the header, pencil (edit) on each card. */
export function CardList({ title, items, createTo, createLabel, emptyText }: CardListProps) {
  return (
    <section className="card-list" aria-label={title}>
      <header className="card-list__header">
        <h2>{title}</h2>
        {createTo && (
          <Link
            to={createTo}
            className="icon-button icon-button--primary"
            aria-label={createLabel ?? `Create in ${title}`}
            title={createLabel ?? `Create in ${title}`}
          >
            <Plus aria-hidden="true" size={18} />
          </Link>
        )}
      </header>
      {items.length === 0 ? (
        <p className="muted">{emptyText ?? 'Nothing here yet.'}</p>
      ) : (
        <ul className="card-list__grid">
          {items.map((item) => (
            <li key={item.id} className="card">
              <div className="card__body">
                <h3 className="card__title">{item.title}</h3>
                {item.subtitle && <p className="card__subtitle">{item.subtitle}</p>}
                {item.details && <div className="card__details">{item.details}</div>}
              </div>
              {item.editTo && (
                <Link
                  to={item.editTo}
                  className="icon-button"
                  aria-label={`Edit ${item.title}`}
                  title={`Edit ${item.title}`}
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
