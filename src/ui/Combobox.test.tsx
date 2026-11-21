// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { metalOptions } from '../master-data/metals';
import { Combobox, filterOptions } from './Combobox';

afterEach(cleanup);

describe('Combobox', () => {
  it('typing "kel" in a dropdown of metals shows Nickel', async () => {
    render(<Combobox label="Metal" name="metal" options={metalOptions} />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Metal' }), 'kel');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Nickel']);
  });

  it('matches any part of the value, ignoring case', () => {
    const labels = filterOptions(metalOptions, 'IN').map((o) => o.label);
    expect(labels).toEqual(expect.arrayContaining(['Indium', 'Tin', 'Zinc', 'Platinum']));
    expect(labels).not.toContain('Nickel');
  });

  it('submits the chosen value, picked with the keyboard', async () => {
    const { container } = render(<Combobox label="Metal" name="metal" options={metalOptions} />);
    const input = screen.getByRole('combobox', { name: 'Metal' });
    await userEvent.type(input, 'nic{ArrowDown}{Enter}');
    expect(input).toHaveValue('Nickel');
    expect(container.querySelector('input[name="metal"]')).toHaveValue('Nickel');
  });

  it('keeps the last valid choice when the typed text matches nothing', async () => {
    const { container } = render(
      <Combobox label="Metal" name="metal" options={metalOptions} defaultValue="Zinc" />
    );
    const input = screen.getByRole('combobox', { name: 'Metal' });
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    await userEvent.tab();
    expect(input).toHaveValue('');
    expect(container.querySelector('input[name="metal"]')).toHaveValue('');
  });
});
