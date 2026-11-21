import { Lock, Pencil } from 'lucide-react';
import { Form, Link } from 'react-router';
import { Combobox } from '../ui/Combobox';
import { currencyOptions, uomOptions } from './lists';
import { isPastPeriod, type Period } from './periods';

export interface MetalCardData {
  id: string;
  symbol: string;
  name: string;
  baseUom: string;
  baseCurrency: string;
  periods: Period[];
  activeToday: boolean;
}

interface MetalCardProps {
  metal: MetalCardData;
  today: string;
  isAdmin: boolean;
  busy?: boolean;
}

/** One active metal: a periodic-table tile, its base UoM and currency, and its periods. */
export function MetalCard({ metal, today, isAdmin, busy = false }: MetalCardProps) {
  return (
    <li className="card metal-card">
      <div className="metal-card__tile" aria-hidden="true">
        {metal.symbol}
      </div>
      <div className="card__body">
        <h3 className="card__title">{metal.name}</h3>
        <p className="card__subtitle">
          <span className={metal.activeToday ? 'badge badge--known' : 'badge badge--last-known'}>
            {metal.activeToday ? 'Active' : 'Inactive'}
          </span>
        </p>
        <Form
          method="post"
          className="metal-card__units"
          key={`${metal.baseUom}-${metal.baseCurrency}`}
        >
          <input type="hidden" name="intent" value="units" />
          <input type="hidden" name="id" value={metal.id} />
          <fieldset disabled={!isAdmin || busy}>
            <Combobox
              label="Base UoM"
              name="baseUom"
              options={uomOptions}
              defaultValue={metal.baseUom}
              required
            />
            <Combobox
              label="Base currency"
              name="baseCurrency"
              options={currencyOptions}
              defaultValue={metal.baseCurrency}
              required
            />
            {isAdmin && (
              <button type="submit" className="button">
                Save units
              </button>
            )}
          </fieldset>
        </Form>
        <h4 className="metal-card__periods-title">Periods</h4>
        <ul className="periods">
          {metal.periods.map((p) => {
            const past = isPastPeriod(p, today);
            return (
              <li key={p.id} className="period">
                <span className={p.status === 'active' ? 'badge badge--known' : 'badge'}>
                  {p.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span>
                  {p.validFrom} to {p.validTo ?? 'open-ended'}
                </span>
                {past && (
                  <span className="muted" title="Ended: its status can no longer change">
                    <Lock aria-hidden="true" size={13} />
                    <span className="visually-hidden">Ended, status locked</span>
                  </span>
                )}
                {isAdmin && (
                  <Link
                    to={`?period=${p.id}`}
                    className="icon-button"
                    aria-label={`Edit ${metal.name} period from ${p.validFrom}`}
                    title="Edit period"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {isAdmin && (
          <Link to={`?add=${metal.id}`} className="button">
            Add period
          </Link>
        )}
      </div>
    </li>
  );
}
