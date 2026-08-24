// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '@/i18n';

vi.mock('@/lib/log', async (importOriginal) => ({
  ...(await importOriginal()),
  getPrayerLog: vi.fn(),
  getLogAnalytics: vi.fn(),
  deleteLogEntry: vi.fn(),
}));

vi.mock('@/lib/prayer', async (importOriginal) => ({
  ...(await importOriginal()),
  getResolvedLocation: vi.fn(),
  getCalculationMethod: vi.fn(),
  getPrayerTimes: vi.fn(),
  isPast: vi.fn(() => true),
  todayDateString: vi.fn(() => '2026-08-25'),
}));

import { deleteLogEntry, getLogAnalytics, getPrayerLog, type LogEntry } from '@/lib/log';
import {
  type CalculationMethod,
  getCalculationMethod,
  getPrayerTimes,
  getResolvedLocation,
} from '@/lib/prayer';
import { LogPage } from '@/pages/log';

const ENTRY: LogEntry = {
  log_date: '2026-08-25',
  prayer: 'fajr',
  logged_at: '2026-08-25T00:00:00Z',
  status: 'on_time',
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LogPage />
    </QueryClientProvider>,
  );
}

describe('LogPage delete confirmation', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrayerLog).mockResolvedValue([ENTRY]);
    vi.mocked(getLogAnalytics).mockResolvedValue({
      streaks: { current: 1, best: 1 },
      month: {
        days_elapsed: 1,
        complete_days: 1,
        on_time: 1,
        qada: 0,
        missed: 0,
        completion_pct: 100,
        on_time_pct: 100,
        qada_pct: 0,
        missed_pct: 0,
      },
    });
    vi.mocked(getResolvedLocation).mockResolvedValue({
      city: null,
      latitude: -6.2088,
      longitude: 106.8456,
      timezone: 'Asia/Jakarta',
    });
    vi.mocked(getCalculationMethod).mockResolvedValue('MWL' as CalculationMethod);
    vi.mocked(getPrayerTimes).mockResolvedValue({
      fajr: '04:30',
      sunrise: '05:45',
      dhuhr: '12:15',
      asr: '15:30',
      maghrib: '18:00',
      isha: '19:15',
    });
  });

  it('cancels the armed confirm without deleting', async () => {
    renderPage();

    const deleteBtn = await screen.findByRole('button', { name: /remove fajr/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByRole('button', { name: /confirm remove fajr/i });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /confirm remove fajr/i }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /remove fajr/i })).toBeInTheDocument();
    expect(deleteLogEntry).not.toHaveBeenCalled();
  });

  it('resets the armed confirm on Escape without deleting', async () => {
    renderPage();

    const deleteBtn = await screen.findByRole('button', { name: /remove fajr/i });
    fireEvent.click(deleteBtn);
    await screen.findByRole('button', { name: /confirm remove fajr/i });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /confirm remove fajr/i }),
      ).not.toBeInTheDocument(),
    );
    expect(deleteLogEntry).not.toHaveBeenCalled();
  });

  it('resets the armed confirm when focus leaves the row', async () => {
    renderPage();

    const deleteBtn = await screen.findByRole('button', { name: /remove fajr/i });
    fireEvent.click(deleteBtn);
    const confirmBtn = await screen.findByRole('button', { name: /confirm remove fajr/i });

    fireEvent.blur(confirmBtn);

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /confirm remove fajr/i }),
      ).not.toBeInTheDocument(),
    );
    expect(deleteLogEntry).not.toHaveBeenCalled();
  });

  it('deletes only after an explicit confirm click', async () => {
    renderPage();

    const deleteBtn = await screen.findByRole('button', { name: /remove fajr/i });
    fireEvent.click(deleteBtn);
    const confirmBtn = await screen.findByRole('button', { name: /confirm remove fajr/i });

    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteLogEntry).toHaveBeenCalledTimes(1));
    expect(deleteLogEntry).toHaveBeenCalledWith('2026-08-25', 'fajr');
  });
});
