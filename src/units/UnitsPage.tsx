import { Converter } from './Converter';
import { unitsPerKg, units } from './units';

export function UnitsPage() {
  return (
    <>
      <h1>Units</h1>
      <section className="panel-form">
        <h2>Conversions</h2>
        <table className="units-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Per 1 kg</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u}>
                <td>{u}</td>
                <td>{unitsPerKg[u]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">1 kg = 2.20462262 lb. 1 mt (metric tonne) = 1,000 kg.</p>
      </section>
      <section className="panel-form">
        <h2>Rounding rules</h2>
        <ul>
          <li>Values are rounded to 2 decimals, and quantities to 5 decimals.</li>
          <li>
            Rounding happens only at the end of a calculation. Steps in between keep every digit.
          </li>
          <li>Ties round up (half up): 0.5 becomes 1, and -0.5 becomes -1.</li>
        </ul>
      </section>
      <Converter />
    </>
  );
}
