// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { CurrencyCards } from './CurrencyCards';
import { currencies, currencyCodes, isCurrencyCode } from './currencies';

afterEach(cleanup);

const hedgile = {
  id: 'co_hedgile_limited',
  name: 'Hedgile Limited',
  baseCurrency: 'USD',
  reportingCurrency: null,
};

function renderCards(props: Partial<Parameters<typeof CurrencyCards>[0]> = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <CurrencyCards
            baseCurrency="USD"
            entities={[hedgile]}
            editingId={null}
            canEdit
            {...props}
          />
        ),
      },
    ],
    { initialEntries: ['/settings/currencies'] }
  );
  return render(<RouterProvider router={router} />);
}

describe('currency list', () => {
  it('has unique three-letter codes and includes the common ones', () => {
    expect(new Set(currencyCodes).size).toBe(currencies.length);
    for (const [code] of currencies) expect(code).toMatch(/^[A-Z]{3}$/);
    for (const code of ['USD', 'EUR', 'GBP', 'CNY', 'HKD', 'IDR']) {
      expect(isCurrencyCode(code)).toBe(true);
    }
    expect(isCurrencyCode('XYZ')).toBe(false);
  });
});

describe('currency cards', () => {
  it('shows the locked organisation base currency', () => {
    renderCards();
    const org = screen.getByRole('region', { name: 'Organisation base currency' });
    expect(within(org).getByText('USD')).toBeInTheDocument();
    expect(within(org).getByText(/cannot be changed/)).toBeInTheDocument();
  });

  it('shows Hedgile Limited with USD base (locked) and USD (default) reporting with a pencil', () => {
    renderCards();
    const base = screen.getByText('Base currency', { selector: 'dt' }).nextElementSibling;
    expect(base).toHaveTextContent('USD');
    expect(within(base as HTMLElement).getByText(/cannot be changed/)).toBeInTheDocument();
    const reporting = screen.getByText('Reporting currency').nextElementSibling;
    expect(reporting).toHaveTextContent('USD (default)');
    expect(
      screen.getByRole('link', { name: 'Edit reporting currency of Hedgile Limited' })
    ).toHaveAttribute('href', '/settings/currencies?edit=co_hedgile_limited');
  });

  it('shows a chosen reporting currency without "(default)"', () => {
    renderCards({ entities: [{ ...hedgile, reportingCurrency: 'EUR' }] });
    const reporting = screen.getByText('Reporting currency').nextElementSibling;
    expect(reporting).toHaveTextContent('EUR');
    expect(reporting).not.toHaveTextContent('default');
  });

  it('edits inline with a type-ahead of all currencies, starting at the effective one', () => {
    renderCards({ editingId: hedgile.id });
    const input = screen.getByRole('combobox', { name: 'Reporting currency of Hedgile Limited' });
    expect(input).toHaveValue('USD · US Dollar');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Edit reporting currency/ })).not.toBeInTheDocument();
  });

  it('shows no pencil to someone who is not an admin', () => {
    renderCards({ canEdit: false, editingId: hedgile.id });
    expect(screen.queryByRole('link', { name: /Edit reporting currency/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
