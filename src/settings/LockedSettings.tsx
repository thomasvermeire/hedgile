import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Lock } from '../ui/Lock';
import {
  directionArrows,
  directionLabels,
  type Connection,
  type ConnectionGroup,
  type LockedSection,
} from './locked-content';

/** The banner at the top of a locked page: a lock and what will come. */
export function LockBanner({ children }: { children: ReactNode }) {
  return (
    <div className="locked-banner" role="note">
      <Lock label="Locked" />
      <p>{children}</p>
    </div>
  );
}

/** A locked card: a lock and a sentence on what will come. */
export function LockedCard({ section }: { section: LockedSection }) {
  return (
    <section className="locked-card" aria-label={section.title}>
      <header className="locked-card__header">
        <h2>{section.title}</h2>
        <Lock label={`${section.title} is locked`} />
      </header>
      <p className="muted">{section.explanation}</p>
    </section>
  );
}

const lockedHint = 'Locked: available when connections are built';

function DisabledIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button type="button" className="icon-button" disabled aria-label={label} title={lockedHint}>
      {children}
    </button>
  );
}

function ConnectionCard({ connection }: { connection: Connection }) {
  return (
    <li className="card locked-connection">
      <div className="card__body">
        <h3 className="card__title">{connection.name}</h3>
        <p className="locked-connection__direction">
          <span aria-hidden="true">{directionArrows[connection.direction]}</span>{' '}
          <span data-testid="direction">{directionLabels[connection.direction]}</span>
        </p>
        <p className="card__subtitle">{connection.purpose}</p>
        <span className="badge badge--inactive">Inactive</span>
      </div>
      <div className="locked-connection__actions">
        <DisabledIcon label={`Edit ${connection.name}`}>
          <Pencil aria-hidden="true" size={16} />
        </DisabledIcon>
        <DisabledIcon label={`Delete ${connection.name}`}>
          <Trash2 aria-hidden="true" size={16} />
        </DisabledIcon>
      </div>
    </li>
  );
}

/** One group of connections: locked create icon in the header, locked edit/delete on each card. */
export function ConnectionGroupCard({ group }: { group: ConnectionGroup }) {
  return (
    <section className="locked-card" aria-label={group.title}>
      <header className="locked-card__header">
        <h2>{group.title}</h2>
        <Lock label={`${group.title} connections are locked`} />
        <span className="locked-card__spacer" />
        <DisabledIcon label={`Create ${group.title} connection`}>
          <Plus aria-hidden="true" size={18} />
        </DisabledIcon>
      </header>
      <p className="muted">{group.explanation}</p>
      <ul className="card-list__grid">
        {group.connections.map((c) => (
          <ConnectionCard key={c.id} connection={c} />
        ))}
      </ul>
    </section>
  );
}
