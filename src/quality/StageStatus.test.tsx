// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StageStatus } from './StageStatus';

afterEach(cleanup);

describe('StageStatus', () => {
  it('shows active and inactive without a lock', () => {
    render(
      <>
        <StageStatus status="active" />
        <StageStatus status="inactive" />
      </>
    );
    expect(screen.getByText('Active')).toHaveClass('badge--stage-active');
    expect(screen.getByText('Inactive')).toHaveClass('badge--stage-inactive');
    expect(screen.queryByText(/not available yet/)).toBeNull();
  });

  it('shows locked with a lock', () => {
    render(<StageStatus status="locked" />);
    expect(screen.getByText('Locked')).toHaveClass('badge--stage-locked');
    expect(screen.getByText('Locked: not available yet')).toBeInTheDocument();
  });
});
