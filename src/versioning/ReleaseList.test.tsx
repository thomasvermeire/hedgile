// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReleaseList } from './ReleaseList';
import { releases } from './releases';

afterEach(cleanup);

describe('ReleaseList', () => {
  it('lists releases newest first with changes grouped by type', () => {
    render(<ReleaseList releases={releases} currentVersion="0.2.0" />);
    const items = screen.getAllByRole('listitem').filter((li) => li.classList.contains('release'));
    expect(items).toHaveLength(releases.length);
    const newest = within(items[0] as HTMLElement);
    expect(newest.getByRole('heading', { level: 2 })).toHaveTextContent('v0.2.0');
    expect(newest.getByText('Running')).toBeInTheDocument();
    expect(newest.getByText('Changes since v0.1.0')).toBeInTheDocument();
    expect(newest.getByRole('heading', { name: 'Stories' })).toBeInTheDocument();
    expect(newest.getByRole('heading', { name: 'Improvements' })).toBeInTheDocument();
    expect(newest.queryByRole('heading', { name: 'Bugs' })).toBeNull();
    const oldest = within(items[1] as HTMLElement);
    expect(oldest.queryByText('Running')).toBeNull();
    expect(oldest.getByText('First release')).toBeInTheDocument();
    expect(oldest.getByText('Set up the project')).toBeInTheDocument();
  });
});
