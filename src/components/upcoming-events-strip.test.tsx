// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { getUpcomingHijriEvents, type UpcomingEvent } from '@/lib/hijri';
import { UpcomingEventsStrip } from './upcoming-events-strip';

vi.mock('@/lib/hijri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hijri')>();
  return { ...actual, getUpcomingHijriEvents: vi.fn() };
});

const EID: UpcomingEvent = {
  id: 'eid_al_fitr',
  hijri_year: 1447,
  gregorian_date: '2026-03-20',
  is_today: false,
  estimated: false,
};

function renderStrip() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <UpcomingEventsStrip />
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await initI18n();
});

describe('UpcomingEventsStrip error state', () => {
  it('stays visible with an error + Retry instead of vanishing on failure', async () => {
    vi.mocked(getUpcomingHijriEvents).mockRejectedValue(new Error('offline'));
    renderStrip();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load upcoming observances.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('recovers via Retry once the query starts succeeding', async () => {
    vi.mocked(getUpcomingHijriEvents).mockRejectedValueOnce(new Error('offline'));
    vi.mocked(getUpcomingHijriEvents).mockResolvedValueOnce([EID]);
    renderStrip();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Eid al-Fitr')).toBeInTheDocument();
  });

  it('still hides on an empty result set', async () => {
    vi.mocked(getUpcomingHijriEvents).mockResolvedValue([]);
    renderStrip();
    await vi.waitFor(() => expect(vi.mocked(getUpcomingHijriEvents)).toHaveBeenCalled());
    expect(screen.queryByTestId('upcoming-events-strip')).not.toBeInTheDocument();
  });
});
