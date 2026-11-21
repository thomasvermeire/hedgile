// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodicTable } from './PeriodicTable';

afterEach(cleanup);

describe('PeriodicTable', () => {
  it('shows all 118 elements as buttons', () => {
    render(<PeriodicTable activeSymbols={[]} />);
    expect(screen.getAllByRole('button')).toHaveLength(118);
  });

  it('disables non-metals and metalloids so they cannot be selected', () => {
    render(<PeriodicTable activeSymbols={[]} />);
    for (const name of [
      'Oxygen (O)',
      'Carbon (C)',
      'Silicon (Si)',
      'Germanium (Ge)',
      'Helium (He)',
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) })
      ).toBeDisabled();
    }
  });

  it('leaves metals clickable and submits their symbol', async () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
      return submitter.value;
    });
    render(
      <form onSubmit={onSubmit}>
        <PeriodicTable activeSymbols={['Ni']} />
      </form>
    );
    const copper = screen.getByRole('button', { name: 'Copper (Cu), activate' });
    expect(copper).toBeEnabled();
    await userEvent.click(copper);
    expect(onSubmit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: /^Oxygen/ }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('highlights active metals', () => {
    render(<PeriodicTable activeSymbols={['Ni', 'Co']} />);
    expect(screen.getByRole('button', { name: 'Nickel (Ni), active' })).toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Cobalt (Co), active' })).toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Copper (Cu), activate' })).not.toHaveClass(
      'is-active'
    );
  });

  it('is usable with the keyboard', async () => {
    render(<PeriodicTable activeSymbols={[]} />);
    await userEvent.tab();
    // The first focusable element is lithium: hydrogen and helium are non-metals.
    expect(screen.getByRole('button', { name: /^Lithium/ })).toHaveFocus();
  });
});
