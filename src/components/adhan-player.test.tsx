// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdhanPlayer } from '@/components/adhan-player';
import { initI18n } from '@/i18n';

const captured = vi.hoisted(() => ({
  cb: undefined as unknown as (event: { payload: { prayer: string; time: string } }) => void,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    async (_event: string, cb: (e: { payload: { prayer: string; time: string } }) => void) => {
      captured.cb = cb;
      return () => {};
    },
  ),
}));

vi.mock('@/lib/prayer', () => ({
  getNotificationEnabled: vi.fn().mockResolvedValue(true),
  getAdhanEnabled: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

function triggerPrayerEvent(): Promise<void> {
  return act(async () => {
    captured.cb({ payload: { prayer: 'fajr', time: '05:00' } });
  });
}

describe('AdhanPlayer', () => {
  it('surfaces a visible notice when play() is rejected (autoplay blocked)', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new Error('NotAllowedError: play() failed'),
    );
    render(<AdhanPlayer />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await triggerPrayerEvent();
    expect(screen.getByRole('status')).toHaveTextContent(/playback was blocked/i);
  });

  it('clears the notice when a later prayer event plays successfully', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValueOnce();
    render(<AdhanPlayer />);
    await triggerPrayerEvent();
    expect(screen.getByRole('status')).toHaveTextContent(/playback was blocked/i);
    await triggerPrayerEvent();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(playSpy).toHaveBeenCalledTimes(2);
  });

  it('dismisses the notice without affecting the next-prayer listener', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    render(<AdhanPlayer />);
    await triggerPrayerEvent();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // The listener stays registered — a later event retries playback.
    await triggerPrayerEvent();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
