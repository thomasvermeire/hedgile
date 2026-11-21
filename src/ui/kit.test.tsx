// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMenu } from '../navigation/menu';
import { Sidebar } from '../navigation/Sidebar';
import { CardList } from './CardList';
import { KnownBadge } from './KnownBadge';
import { rowClassName } from './rows';

afterEach(cleanup);

function inRouter(element: React.ReactElement, path = '/') {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('Sidebar', () => {
  it('shows locked entries with a lock and no link', () => {
    inRouter(
      <Sidebar menu={buildMenu([{ id: 'ref1', name: 'LME Nickel Cash' }])} />,
      '/process/sales/lots'
    );
    expect(screen.getAllByText('Currencies is locked')).toHaveLength(1);
    expect(screen.getAllByText(/Quotes is locked/)).toHaveLength(2);
    const currencies = screen.getByText('Currencies').closest('[aria-disabled]');
    expect(currencies).toHaveAttribute('aria-disabled', 'true');
    expect(currencies?.closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'LME Nickel Cash' })).toHaveAttribute(
      'href',
      '/market-data/metals/ref1'
    );
    expect(screen.getAllByRole('link', { name: 'Lots' })[1]).toHaveClass('is-active');
  });
});

describe('CardList', () => {
  it('has a plus to create and a pencil on each card', () => {
    inRouter(
      <CardList
        title="Companies"
        createTo="?new"
        createLabel="Create company"
        items={[{ id: 'c1', title: 'Rival Metals', subtitle: 'DE', editTo: '?edit=c1' }]}
      />
    );
    expect(screen.getByRole('link', { name: 'Create company' })).toHaveAttribute('href', '/?new');
    expect(screen.getByRole('link', { name: 'Edit Rival Metals' })).toHaveAttribute(
      'href',
      '/?edit=c1'
    );
  });

  it('shows no plus or pencil when not allowed', () => {
    inRouter(<CardList title="Members" items={[{ id: 'm1', title: 'Ann' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('badges and rows', () => {
  it('labels KNOWN and LAST KNOWN', () => {
    render(
      <>
        <KnownBadge status="known" />
        <KnownBadge status="last_known" />
      </>
    );
    expect(screen.getByText('KNOWN')).toHaveClass('badge--known');
    expect(screen.getByText('LAST KNOWN')).toHaveClass('badge--last-known');
  });

  it('marks backtrading rows light red', () => {
    expect(rowClassName({ backtrading: true })).toBe('row row--backtrading');
    expect(rowClassName({})).toBe('row');
  });
});
