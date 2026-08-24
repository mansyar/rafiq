// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from '@/components/update-banner';
import { initI18n } from '@/i18n';
import { useUpdateStore } from '@/lib/update-store';

vi.mock('@/lib/update', () => ({
  runStartupUpdateCheck: vi.fn().mockResolvedValue({ status: 'skipped' }),
  checkForUpdates: vi.fn(),
  tauriUpdatePorts: {
    readLastCheck: vi.fn().mockResolvedValue(null),
    writeLastCheck: vi.fn().mockResolvedValue(undefined),
    fetchRemote: vi.fn().mockResolvedValue(null),
    installRemote: vi.fn().mockResolvedValue(undefined),
  },
}));

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useUpdateStore.getState().reset();
  vi.clearAllMocks();
});

describe('UpdateBanner', () => {
  it('stays hidden for a plain check error (nothing to retry)', () => {
    useUpdateStore.setState({ status: { kind: 'error' } });
    render(<UpdateBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a Try again card after an install failure instead of vanishing', () => {
    useUpdateStore.setState({ status: { kind: 'error', retryInstall: true } });
    render(<UpdateBanner />);
    const card = screen.getByRole('status');
    expect(card).toHaveTextContent("Couldn't install the update.");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('Try again re-triggers the install after a failure', async () => {
    const { tauriUpdatePorts } = await import('@/lib/update');
    const installRemote = vi.mocked(tauriUpdatePorts.installRemote);
    installRemote.mockRejectedValueOnce(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    useUpdateStore.setState({
      status: { kind: 'available', version: '1.2.0', notes: null },
    });
    render(<UpdateBanner />);

    // First attempt: restart-to-update → install fails → banner becomes retryable.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart to update' }));
    });
    await waitFor(() => {
      expect(useUpdateStore.getState().status).toEqual({ kind: 'error', retryInstall: true });
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    // Second attempt: Try again → installRemote runs again.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(installRemote).toHaveBeenCalledTimes(2);
    expect(useUpdateStore.getState().installing).toBe(true);
    errorSpy.mockRestore();
  });
});
