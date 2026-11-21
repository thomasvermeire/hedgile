import { elements } from './elements';

interface PeriodicTableProps {
  /** Symbols of the metals that are active today: highlighted and not selectable again. */
  activeSymbols: readonly string[];
  /** Disables every button, e.g. while saving. */
  disabled?: boolean;
}

/**
 * The Mendeleev table. Every element is a real button that submits its symbol as `symbol`
 * (wrap it in a form). Non-metals and metals that are already active are disabled.
 */
export function PeriodicTable({ activeSymbols, disabled = false }: PeriodicTableProps) {
  const active = new Set(activeSymbols);
  return (
    <div className="periodic-table" role="group" aria-label="Periodic table of the elements">
      {elements.map((e) => {
        const isActive = active.has(e.symbol);
        const state = !e.isMetal ? 'not a metal' : isActive ? 'active' : 'activate';
        const className = [
          'element',
          e.isMetal ? 'element--metal' : 'element--nonmetal',
          isActive ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={e.symbol}
            type="submit"
            name="symbol"
            value={e.symbol}
            className={className}
            style={{ gridColumn: e.column, gridRow: e.row }}
            disabled={disabled || !e.isMetal || isActive}
            aria-label={`${e.name} (${e.symbol}), ${state}`}
            title={`${e.name}, ${state}`}
          >
            <span className="element__number">{e.number}</span>
            <span className="element__symbol">{e.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}
