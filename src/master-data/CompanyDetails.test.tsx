// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { Company } from './companies.server';
import { CompanyDetails } from './CompanyDetails';

afterEach(cleanup);

const hedgileLimited: Company = {
  id: 'co_hedgile_limited',
  name: 'Hedgile Limited',
  legalName: 'Hedgile Limited',
  commercialName: 'Hedgile',
  country: 'HK',
  vatNumber: 'HK-VAT-1',
  registrationNumber: '1234567',
  addressLine1: 'Suite 2108, 21/F',
  addressLine2: 'Two Exchange Square, 8 Connaught Place',
  city: 'Central',
  postalCode: null,
  stateProvince: 'Hong Kong',
  website: 'hedgile.com',
  contactPerson: 'Ingrid Ingot',
  contactEmail: 'ingrid@hedgile.test',
  contactPhone: '+852 0000 0000',
  stockValuationMethod: 'WAVG',
  baseCurrency: 'USD',
  reportingCurrency: null,
  address: null,
};

function renderCard(company: Company) {
  const router = createMemoryRouter(
    [{ path: '*', element: <CompanyDetails company={company} attachments={[]} /> }],
    { initialEntries: ['/master-data/companies'] }
  );
  return render(<RouterProvider router={router} />);
}

describe('company card', () => {
  it('shows all fields of Hedgile Limited', () => {
    renderCard(hedgileLimited);
    for (const label of [
      'Legal name',
      'Commercial name',
      'Address',
      'VAT number',
      'Registration number',
      'Website',
      'Contact person',
      'Contact email',
      'Contact phone',
      'Stock valuation',
      'Base currency',
      'Reporting currency',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Two Exchange Square, 8 Connaught Place')).toBeInTheDocument();
    expect(screen.getByText('Ingrid Ingot')).toBeInTheDocument();
    expect(screen.getByText('WAVG')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hedgile.com' })).toHaveAttribute(
      'href',
      'https://hedgile.com'
    );
  });

  it('shows the base currency with a lock that opens Settings > Currencies, and a pencil for the reporting currency', () => {
    renderCard(hedgileLimited);
    const base = screen.getByText('Base currency').nextElementSibling as HTMLElement;
    expect(within(base).getByText('USD')).toBeInTheDocument();
    expect(within(base).getByRole('link')).toHaveAttribute('href', '/settings/currencies');
    expect(
      screen.getByRole('link', { name: 'Edit reporting currency of Hedgile Limited' })
    ).toHaveAttribute('href', '/master-data/companies?edit=co_hedgile_limited');
  });

  it('shows the base currency as the default reporting currency, and an explicit one as chosen', () => {
    const { unmount } = renderCard(hedgileLimited);
    const reporting = screen.getByText('Reporting currency').nextElementSibling as HTMLElement;
    expect(reporting).toHaveTextContent('USD (default)');
    expect(screen.queryByText('Not set')).not.toBeInTheDocument();
    unmount();
    renderCard({ ...hedgileLimited, reportingCurrency: 'EUR' });
    const chosen = screen.getByText('Reporting currency').nextElementSibling as HTMLElement;
    expect(chosen).toHaveTextContent('EUR');
    expect(chosen).not.toHaveTextContent('default');
  });

  it('falls back to the one-line address when the separate fields are empty', () => {
    renderCard({
      ...hedgileLimited,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateProvince: null,
      address: 'Hafenstr. 1, Hamburg',
      country: 'DE',
    });
    expect(screen.getByText('Hafenstr. 1, Hamburg')).toBeInTheDocument();
  });
});
