import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ReportingCurrencyValue } from '../currencies/ReportingCurrencyValue';
import { Lock } from '../ui/Lock';
import type { Company } from './companies.server';

/** The address as lines: the separate fields when filled, else the one-line address. */
function addressLines(c: Company): string[] {
  const cityLine = [c.postalCode, c.city].filter(Boolean).join(' ');
  const lines = [c.addressLine1, c.addressLine2, cityLine, c.stateProvince, c.country].filter(
    (l): l is string => Boolean(l)
  );
  return c.addressLine1 ? lines : [c.address, c.country].filter((l): l is string => Boolean(l));
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CompanyDetails({
  company: c,
  attachments,
}: {
  company: Company;
  attachments: { id: string; filename: string }[];
}) {
  const address = addressLines(c);
  return (
    <dl className="details">
      <Detail label="Legal name" value={c.legalName} />
      <Detail label="Commercial name" value={c.commercialName} />
      <Detail
        label="Address"
        value={
          address.length ? (
            <address>
              {address.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          ) : null
        }
      />
      <Detail label="VAT number" value={c.vatNumber} />
      <Detail label="Registration number" value={c.registrationNumber} />
      <Detail
        label="Website"
        value={
          c.website ? (
            <a
              href={/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`}
              target="_blank"
              rel="noreferrer"
            >
              {c.website}
            </a>
          ) : null
        }
      />
      <Detail label="Contact person" value={c.contactPerson} />
      <Detail
        label="Contact email"
        value={c.contactEmail ? <a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a> : null}
      />
      <Detail label="Contact phone" value={c.contactPhone} />
      <Detail label="Stock valuation" value={c.stockValuationMethod} />
      <Detail
        label="Base currency"
        value={
          <span className="inline-actions">
            {c.baseCurrency}
            <Link
              to="/settings/currencies"
              className="icon-link"
              aria-label="Base currency is set in Settings > Currencies"
              title="Base currency is set in Settings > Currencies"
            >
              <Lock label="Base currency is set in Settings > Currencies" />
            </Link>
          </span>
        }
      />
      <Detail
        label="Reporting currency"
        value={
          <span className="inline-actions">
            <ReportingCurrencyValue company={c} />
            <Link
              to={`?edit=${c.id}`}
              className="icon-link"
              aria-label={`Edit reporting currency of ${c.name}`}
              title="Edit reporting currency"
            >
              <Pencil aria-hidden="true" size={14} />
            </Link>
          </span>
        }
      />
      {attachments.length > 0 && (
        <Detail
          label="Documents"
          value={attachments.map((a) => (
            <a
              key={a.id}
              href={`/attachments/${a.id}`}
              className="attachment"
              target="_blank"
              rel="noreferrer"
            >
              {a.filename}
            </a>
          ))}
        />
      )}
    </dl>
  );
}
