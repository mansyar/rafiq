import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHECK_INTERVAL_MS,
  checkForUpdates,
  isCheckDue,
  LAST_CHECK_KEY,
  parseLastCheck,
  runStartupUpdateCheck,
  tauriUpdatePorts,
  type UpdatePorts,
} from './update';

const checkMock = vi.fn();
const relaunchMock = vi.fn();
const getSettingMock = vi.fn();
const setSettingMock = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => checkMock(...args),
}));
vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => relaunchMock(...args),
}));
vi.mock('./tauri', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

const HOUR_MS = 60 * 60 * 1000;
/** Fixed "now" so interval math is deterministic. */
const NOW_MS = 1_800_000_000_000;

interface FakePorts extends UpdatePorts {
  /** Epoch-ms values passed to writeLastCheck, in call order. */
  writes: number[];
  /** Number of times fetchRemote was invoked. */
  remoteCalls: number;
}

function fakePorts(
  remote: () => Promise<{ version: string; body?: string } | null>,
  storedRaw: string | null = null,
): FakePorts {
  const ports: FakePorts = {
    writes: [],
    remoteCalls: 0,
    readLastCheck: async () => storedRaw,
    writeLastCheck: async (ms) => {
      ports.writes.push(ms);
    },
    fetchRemote: async () => {
      ports.remoteCalls += 1;
      return remote();
    },
    installRemote: async () => {},
  };
  return ports;
}

describe('parseLastCheck', () => {
  it('parses stored epoch-millisecond strings', () => {
    expect(parseLastCheck('0')).toBe(0);
    expect(parseLastCheck(String(NOW_MS))).toBe(NOW_MS);
  });

  it('returns null for unset or malformed values', () => {
    expect(parseLastCheck(null)).toBeNull();
    expect(parseLastCheck('')).toBeNull();
    expect(parseLastCheck('yesterday')).toBeNull();
    expect(parseLastCheck('-42')).toBeNull();
    expect(parseLastCheck('12.5')).toBeNull();
  });
});

describe('isCheckDue', () => {
  it('is due when never checked', () => {
    expect(isCheckDue(null, NOW_MS)).toBe(true);
  });

  it('is not due within the 24h minimum interval', () => {
    expect(isCheckDue(NOW_MS - CHECK_INTERVAL_MS + 1, NOW_MS)).toBe(false);
    expect(isCheckDue(NOW_MS - 23 * HOUR_MS, NOW_MS)).toBe(false);
  });

  it('is due once the interval has elapsed', () => {
    expect(isCheckDue(NOW_MS - CHECK_INTERVAL_MS, NOW_MS)).toBe(true);
    expect(isCheckDue(NOW_MS - 2 * CHECK_INTERVAL_MS, NOW_MS)).toBe(true);
  });
});

describe('runStartupUpdateCheck (silent launch check)', () => {
  it('checks and reports an available update, persisting the attempt', async () => {
    const ports = fakePorts(async () => ({ version: '1.1.0', body: 'Fixes' }));
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({
      status: 'available',
      version: '1.1.0',
      notes: 'Fixes',
    });
    expect(ports.remoteCalls).toBe(1);
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('reports latest when upstream has no release', async () => {
    const ports = fakePorts(async () => null);
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({ status: 'latest' });
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('degrades silently to error when offline (no throw), recording the attempt', async () => {
    const ports = fakePorts(async () => {
      throw new Error('network unreachable');
    });
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({ status: 'error' });
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('skips silently when the last check is under 24h old', async () => {
    const ports = fakePorts(async () => ({ version: '1.1.0' }), String(NOW_MS - 23 * HOUR_MS));
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({ status: 'skipped' });
    expect(ports.remoteCalls).toBe(0);
    expect(ports.writes).toEqual([]);
  });

  it('proceeds when the stored check is older than 24h', async () => {
    const ports = fakePorts(async () => null, String(NOW_MS - CHECK_INTERVAL_MS));
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({ status: 'latest' });
    expect(ports.remoteCalls).toBe(1);
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('treats malformed stored timestamps as never-checked', async () => {
    const ports = fakePorts(async () => null, 'garbage');
    await expect(runStartupUpdateCheck(ports, NOW_MS)).resolves.toEqual({ status: 'latest' });
    expect(ports.remoteCalls).toBe(1);
  });
});

describe('checkForUpdates (manual settings check)', () => {
  it('ignores the 24h throttle and always contacts upstream', async () => {
    const ports = fakePorts(async () => ({ version: '2.0.0' }), String(NOW_MS - HOUR_MS));
    await expect(checkForUpdates(ports, NOW_MS)).resolves.toEqual({
      status: 'available',
      version: '2.0.0',
      notes: null,
    });
    expect(ports.remoteCalls).toBe(1);
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('reports latest and persists the attempt', async () => {
    const ports = fakePorts(async () => null, String(NOW_MS));
    await expect(checkForUpdates(ports, NOW_MS)).resolves.toEqual({ status: 'latest' });
    expect(ports.writes).toEqual([NOW_MS]);
  });

  it('maps upstream failure to a silent error outcome', async () => {
    const ports = fakePorts(async () => {
      throw new Error('timeout');
    });
    await expect(checkForUpdates(ports, NOW_MS)).resolves.toEqual({ status: 'error' });
    expect(ports.writes).toEqual([NOW_MS]);
  });
});

describe('settings key contract', () => {
  it('uses a stable snake_case key matching Rust settings rows', () => {
    expect(LAST_CHECK_KEY).toBe('updater_last_check_at');
  });
});

describe('tauriUpdatePorts (production glue)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the persisted timestamp via the settings store', async () => {
    getSettingMock.mockResolvedValue('123');
    await expect(tauriUpdatePorts.readLastCheck()).resolves.toBe('123');
    expect(getSettingMock).toHaveBeenCalledWith(LAST_CHECK_KEY);
  });

  it('persists the timestamp as a decimal string under the settings key', async () => {
    setSettingMock.mockResolvedValue(undefined);
    await tauriUpdatePorts.writeLastCheck(456);
    expect(setSettingMock).toHaveBeenCalledWith(LAST_CHECK_KEY, '456');
  });

  it('fetchRemote maps a plugin update to the port shape', async () => {
    checkMock.mockResolvedValue({ version: '2.0.0', body: 'Hi' });
    await expect(tauriUpdatePorts.fetchRemote()).resolves.toEqual({
      version: '2.0.0',
      body: 'Hi',
    });
  });

  it('fetchRemote normalizes missing release notes to null', async () => {
    checkMock.mockResolvedValue({ version: '2.0.0' });
    await expect(tauriUpdatePorts.fetchRemote()).resolves.toEqual({
      version: '2.0.0',
      body: null,
    });
  });

  it('fetchRemote resolves null when already up-to-date', async () => {
    checkMock.mockResolvedValue(null);
    await expect(tauriUpdatePorts.fetchRemote()).resolves.toBeNull();
  });

  it('installRemote rejects when no check has produced an update', async () => {
    await expect(tauriUpdatePorts.installRemote()).rejects.toThrow(/no pending update/);
    expect(relaunchMock).not.toHaveBeenCalled();
  });

  it('installRemote downloads, installs, then relaunches', async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue({ version: '2.0.0', body: null, downloadAndInstall });
    await tauriUpdatePorts.fetchRemote();
    relaunchMock.mockResolvedValue(undefined);
    await tauriUpdatePorts.installRemote();
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunchMock).toHaveBeenCalledTimes(1);
  });
});
