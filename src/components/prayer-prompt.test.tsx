// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '@/i18n';

const captured = vi.hoisted(() => ({
  cb: undefined as unknown as (e: { payload: { prayer: string; time: string } }) => void,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    async (_event: string, cb: (e: { payload: { prayer: string; time: string } }) => void) => {
      captured.cb = cb;
      return () => {};
    },
  ),
}));

vi.mock('@/lib/log', () => ({
  getPrayerLog: vi.fn(),
  isLoggablePrayer: vi.fn(),
  logPrayer: vi.fn(),
}));

vi.mock('@/lib/prayer', () => ({
  formatPrayerTime: vi.fn((time: string) => time),
  getResolvedLocation: vi.fn(),
  todayDateString: vi.fn(() => '2026-08-25'),
}));

import { PrayerPrompt } from '@/components/prayer-prompt';
import { getPrayerLog, isLoggablePrayer, type LogEntry, logPrayer } from '@/lib/log';
import { getResolvedLocation } from '@/lib/prayer';

function triggerPrayerEvent() {
  act(() => {
    captured.cb({ payload: { prayer: 'dhuhr', time: '12:30' } });
  });
}

describe('PrayerPrompt double-submit guard', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrayerLog).mockResolvedValue([]);
    vi.mocked(isLoggablePrayer).mockReturnValue(true);
    vi.mocked(getResolvedLocation).mockResolvedValue({
      city: null,
      latitude: -6.2088,
      longitude: 106.8456,
      timezone: 'Asia/Jakarta',
    });
  });

  afterEach(() => {
    // The component registers a global keydown listener per prompt; jsdom
    // cleanup from setup.ts unmounts it, but reset the module-level state too.
    document.body.innerHTML = '';
  });

  it('disables the button and shows "Logging…" while logPrayer is in flight', async () => {
    let resolveLog: (value: LogEntry) => void = () => {};
    const gate = new Promise<LogEntry>((res) => {
      resolveLog = res;
    });
    vi.mocked(logPrayer).mockReturnValue(gate);

    render(<PrayerPrompt />);
    triggerPrayerEvent();

    const prayed = await screen.findByRole('button', { name: 'Prayed' });
    fireEvent.click(prayed);

    await waitFor(() => expect(prayed).toBeDisabled());
    expect(prayed).toHaveTextContent('Logging…');
    expect(logPrayer).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLog({
        log_date: '2026-08-25',
        prayer: 'dhuhr',
        logged_at: '2026-08-25T05:00:00Z',
        status: 'on_time',
      });
    });
    await waitFor(() => expect(screen.getByText(/may it be accepted/i)).toBeInTheDocument());
  });

  it('does not double-log on a double click while submitting', async () => {
    let resolveLog: (value: LogEntry) => void = () => {};
    const gate = new Promise<LogEntry>((res) => {
      resolveLog = res;
    });
    vi.mocked(logPrayer).mockReturnValue(gate);

    render(<PrayerPrompt />);
    triggerPrayerEvent();

    const prayed = await screen.findByRole('button', { name: 'Prayed' });
    fireEvent.click(prayed);
    fireEvent.click(prayed);

    await waitFor(() => expect(prayed).toBeDisabled());
    expect(logPrayer).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLog({
        log_date: '2026-08-25',
        prayer: 'dhuhr',
        logged_at: '2026-08-25T05:00:00Z',
        status: 'on_time',
      });
    });
  });

  it('replaces the ask action with the error phase after a failed log attempt', async () => {
    vi.mocked(logPrayer).mockRejectedValue(new Error('storage unavailable'));

    render(<PrayerPrompt />);
    triggerPrayerEvent();

    const prayed = await screen.findByRole('button', { name: 'Prayed' });
    fireEvent.click(prayed);

    await waitFor(() => expect(screen.getByText(/couldn.t log/i)).toBeInTheDocument());
    // The ask-phase button is replaced by the inline error; the next prayer
    // event starts a fresh prompt with an enabled button.
    expect(screen.queryByRole('button', { name: 'Prayed' })).not.toBeInTheDocument();
  });
});
