// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UnitsPage } from './UnitsPage';

afterEach(cleanup);

describe('Units page', () => {
  it('shows the factors and the rounding rules', () => {
    render(<UnitsPage />);
    expect(screen.getByText('2.20462262')).toBeTruthy();
    expect(screen.getByText(/rounded to 2 decimals, and quantities to 5 decimals/)).toBeTruthy();
  });

  it('converts live and rounds to 5 decimals', () => {
    render(<UnitsPage />);
    expect(screen.getByTestId('units-result').textContent).toBe('22,629.25803');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'kg' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'lb' } });
    expect(screen.getByTestId('units-result').textContent).toBe('2.20462');
  });

  it('shows an error for invalid input', () => {
    render(<UnitsPage />);
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: 'abc' } });
    expect(screen.getByText('Enter a number such as 1250.5')).toBeTruthy();
    expect(screen.queryByTestId('units-result')).toBeNull();
  });
});
