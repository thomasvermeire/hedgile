// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { MetalView } from './markets';
import { MetalList } from './MetalList';

afterEach(cleanup);

const metals: MetalView[] = [
  {
    id: 'mtl_ni',
    symbol: 'Ni',
    name: 'Nickel',
    isBook: true,
    references: [
      {
        id: 'ref_lme',
        metalId: 'mtl_ni',
        name: 'LME Nickel Cash Settlement',
        source: 'LME',
        sourceType: 'upload',
        active: true,
      },
    ],
  },
  { id: 'mtl_zn', symbol: 'Zn', name: 'Zinc', isBook: false, references: [] },
];

function renderList(canEdit: boolean) {
  const router = createMemoryRouter([
    { path: '/', element: <MetalList metals={metals} canEdit={canEdit} /> },
  ]);
  render(<RouterProvider router={router} />);
}

function card(name: string): HTMLElement {
  const el = screen.getByRole('heading', { name: new RegExp(name) }).closest('li');
  if (!el) throw new Error(`no card for ${name}`);
  return el;
}

describe('MetalList', () => {
  it('styles book metals and market-only metals differently', () => {
    renderList(true);
    expect(card('Nickel').classList.contains('metal-card--book')).toBe(true);
    expect(card('Nickel').classList.contains('metal-card--market')).toBe(false);
    expect(card('Zinc').classList.contains('metal-card--market')).toBe(true);
    expect(within(card('Nickel')).getByText('Book metal')).toBeTruthy();
    expect(within(card('Zinc')).getByText('Market only')).toBeTruthy();
  });

  it('shows each reference with its source and publisher', () => {
    renderList(true);
    const nickel = card('Nickel');
    expect(within(nickel).getByText('LME Nickel Cash Settlement')).toBeTruthy();
    expect(within(nickel).getByText(/Upload · LME/)).toBeTruthy();
    expect(within(card('Zinc')).getByText('No references yet.')).toBeTruthy();
  });

  it('offers edit controls to admins only', () => {
    renderList(true);
    expect(screen.getByLabelText('Add market-only metal')).toBeTruthy();
    expect(screen.getByLabelText('Edit Zinc')).toBeTruthy();
    cleanup();
    renderList(false);
    expect(screen.queryByLabelText('Add market-only metal')).toBeNull();
    expect(screen.queryByLabelText('Edit Zinc')).toBeNull();
    expect(screen.queryByText('Add reference')).toBeNull();
  });
});
