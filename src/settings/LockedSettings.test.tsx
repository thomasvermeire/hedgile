// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConnectionGroupCard, LockBanner, LockedCard } from './LockedSettings';
import { connectionGroups, ledgerSections } from './locked-content';
import { ValuationOverview } from './ValuationOverview';

afterEach(cleanup);

describe('LockedSettings', () => {
  it('shows a lock and the explanation on a locked card', () => {
    const section = ledgerSections[0]!;
    render(<LockedCard section={section} />);
    const card = screen.getByRole('region', { name: 'Financial GL' });
    expect(within(card).getByText('Financial GL is locked')).toBeTruthy();
    expect(within(card).getByText(section.explanation)).toBeTruthy();
  });

  it('shows a lock in the banner', () => {
    render(<LockBanner>Coming soon</LockBanner>);
    const note = screen.getByRole('note');
    expect(within(note).getByText('Locked')).toBeTruthy();
    expect(within(note).getByText('Coming soon')).toBeTruthy();
  });

  it('shows each ERP connection with direction, purpose and inactive badge, actions disabled', () => {
    const erp = connectionGroups.find((g) => g.id === 'erp')!;
    render(<ConnectionGroupCard group={erp} />);
    const card = screen.getByRole('region', { name: 'ERP' });
    expect(within(card).getAllByText('Inactive')).toHaveLength(erp.connections.length);
    expect(within(card).getAllByTestId('direction')).toHaveLength(erp.connections.length);
    expect(within(card).getAllByText('Into Hedgile').length).toBeGreaterThan(0);
    expect(within(card).getAllByText('From Hedgile').length).toBeGreaterThan(0);
    expect(within(card).getAllByText('Both ways').length).toBeGreaterThan(0);
    expect(within(card).getByText(erp.connections[0]!.purpose)).toBeTruthy();
    const buttons = within(card).getAllByRole('button');
    expect(buttons).toHaveLength(1 + erp.connections.length * 2);
    for (const b of buttons) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
      expect(b.getAttribute('title')).toMatch(/Locked/);
    }
    expect(within(card).getByRole('button', { name: 'Create ERP connection' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Delete Invoices' })).toBeTruthy();
  });

  it('shows each company valuation method read-only', () => {
    render(
      <ValuationOverview
        valuations={[
          { id: 'c1', name: 'Hedgile Limited', method: 'WAVG' },
          { id: 'c2', name: 'Other BV', method: null },
        ]}
      />
    );
    expect(screen.getByText('Hedgile Limited')).toBeTruthy();
    expect(screen.getByText('WAVG')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.getByText('Stock valuation is read-only here')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
