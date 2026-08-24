import { beforeEach, describe, expect, it, vi } from 'vitest';

const isEnabledMock = vi.fn();
const enableMock = vi.fn();
const disableMock = vi.fn();

vi.mock('@tauri-apps/plugin-autostart', () => ({
  isEnabled: (...args: unknown[]) => isEnabledMock(...args),
  enable: (...args: unknown[]) => enableMock(...args),
  disable: (...args: unknown[]) => disableMock(...args),
}));

import { getLaunchAtLogin, setLaunchAtLogin } from './autostart';

describe('launch-at-login (autostart)', () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    enableMock.mockReset();
    disableMock.mockReset();
  });

  it('reports the plugin enabled state', async () => {
    isEnabledMock.mockResolvedValue(true);
    await expect(getLaunchAtLogin()).resolves.toBe(true);
    isEnabledMock.mockResolvedValue(false);
    await expect(getLaunchAtLogin()).resolves.toBe(false);
  });

  it('defaults to false when the backend is unavailable (browser dev / E2E)', async () => {
    isEnabledMock.mockRejectedValue(new Error('not available'));
    await expect(getLaunchAtLogin()).resolves.toBe(false);
  });

  it('enables and disables through the autostart plugin', async () => {
    enableMock.mockResolvedValue(undefined);
    disableMock.mockResolvedValue(undefined);
    await setLaunchAtLogin(true);
    await setLaunchAtLogin(false);
    expect(enableMock).toHaveBeenCalledTimes(1);
    expect(disableMock).toHaveBeenCalledTimes(1);
  });

  it('propagates enable/disable failures to the caller', async () => {
    enableMock.mockRejectedValue(new Error('denied'));
    await expect(setLaunchAtLogin(true)).rejects.toThrow('denied');
  });
});
