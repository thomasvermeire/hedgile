// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProvenanceResult } from '../provenance/provenance';
import { ProvenanceValue } from './ProvenanceValue';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const result: ProvenanceResult = {
  latest: {
    id: 'prv_2',
    objectType: 'line',
    objectId: 'l1',
    field: 'amount',
    value: '61500',
    trigger: 'quantity',
    mode: 'automatic',
    formula: 'price × quantity',
    inputs: [
      { name: 'price', value: 12300, source: 'LME Nickel Cash' },
      { name: 'quantity', value: 5 },
    ],
    userId: 'u1',
    userName: 'Ann Admin',
    userEmail: 'ann@x.test',
    createdAt: '2026-11-21T09:30:00.000Z',
  },
  history: [
    {
      id: 'prv_1',
      objectType: 'line',
      objectId: 'l1',
      field: 'amount',
      value: '36000',
      trigger: 'manual',
      mode: 'manual',
      formula: null,
      inputs: null,
      userId: 'u1',
      userName: 'Ann Admin',
      userEmail: 'ann@x.test',
      createdAt: '2026-11-20T09:30:00.000Z',
    },
  ],
};

function stubFetch(response: Response | Promise<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderFigure() {
  return render(
    <ProvenanceValue objectType="line" objectId="l1" field="amount">
      61 500
    </ProvenanceValue>
  );
}

describe('ProvenanceValue', () => {
  it('opens "Why this value" with trigger, who, when and the calculation', async () => {
    const fetchMock = stubFetch(Response.json(result));
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: '61 500' }));
    expect(screen.getByRole('dialog', { name: 'Why this value' })).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    expect(await screen.findByText('Quantity')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/provenance?objectType=line&objectId=l1&field=amount',
      expect.anything()
    );
    expect(screen.getByText('Automatic')).toBeInTheDocument();
    expect(screen.getByText('Ann Admin')).toBeInTheDocument();
    expect(screen.getByText('2026-11-21 09:30 UTC')).toBeInTheDocument();
    expect(screen.getByText('price × quantity = 12 300 × 5 = 61 500')).toBeInTheDocument();
    expect(screen.getByText('History (1)')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the figure', async () => {
    stubFetch(Response.json(result));
    renderFigure();
    const figure = screen.getByRole('button', { name: '61 500' });
    fireEvent.click(figure);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    await screen.findByText('Quantity');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(figure).toHaveFocus();
  });

  it('says so when nothing was recorded', async () => {
    stubFetch(Response.json({ error: 'not_found' }, { status: 404 }));
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: '61 500' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No provenance has been recorded');
  });

  it('shows an error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: '61 500' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
  });
});
