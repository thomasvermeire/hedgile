import { effectiveReportingCurrency } from './currencies';

/** The reporting currency as shown on cards: "EUR", or "USD (default)" when it follows the base. */
export function ReportingCurrencyValue({
  company,
}: {
  company: { baseCurrency: string; reportingCurrency: string | null };
}) {
  const { code, isDefault } = effectiveReportingCurrency(company);
  return (
    <>
      {code}
      {isDefault && <span className="muted"> (default)</span>}
    </>
  );
}
