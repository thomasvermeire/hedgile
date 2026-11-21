// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PostingDateField } from './PostingDateField';
import { PostingDates } from './PostingDates';
import { rowClassName } from './rows';

afterEach(cleanup);

describe('PostingDates', () => {
  it('shows both dates and flags a backdated posting', () => {
    render(<PostingDates systemDate="2026-11-21T10:00:00.000Z" postingDate="2026-11-18" />);
    expect(screen.getByText('2026-11-21')).toBeInTheDocument();
    expect(screen.getByText('2026-11-18')).toBeInTheDocument();
    expect(screen.getByText('Backdated')).toHaveClass('badge--backdated');
    expect(rowClassName({ backtrading: true })).toBe('row row--backtrading');
  });

  it('shows no flag when posted on the system date', () => {
    render(<PostingDates systemDate="2026-11-21T10:00:00.000Z" postingDate="2026-11-21" />);
    expect(screen.queryByText('Backdated')).toBeNull();
  });
});

describe('PostingDateField', () => {
  it('defaults to today and cannot pick a later date outside test mode', () => {
    render(<PostingDateField testMode={false} todayDate="2026-11-21" />);
    const input = screen.getByLabelText('Posting date');
    expect(input).toHaveValue('2026-11-21');
    expect(input).toHaveAttribute('max', '2026-11-21');
    expect(input).toHaveAttribute('name', 'postingDate');
  });

  it('has no maximum in test mode', () => {
    render(<PostingDateField testMode todayDate="2026-11-21" />);
    expect(screen.getByLabelText('Posting date')).not.toHaveAttribute('max');
  });
});
