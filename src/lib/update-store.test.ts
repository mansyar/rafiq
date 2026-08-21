import { beforeEach, describe, expect, it } from 'vitest';
import type { UpdatePorts } from './update';
import { type UpdateStatus, useUpdateStore } from './update-store';

const HOUR_MS = 60 * 60 * 1000;
const NOW_MS = 1_800_000_000_000;

/** Manual-completion ports so tests can observe the intermediate `checking` state. */
function deferredPorts(
  remote: () => Promise<{ version: string; body?: string } | null>,
): UpdatePorts & { release: () => void } {
  let resolveRemote: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    resolveRemote = resolve;
  });
  return {
    readLastCheck: async () => null,
    writeLastCheck: async () => {},
    fetchRemote: async () => {
      await gate;
      return remote();
    },
    installRemote: async () => {},
    release: () => resolveRemote?.(),
  };
}

function statusKinds(): string[] {
  const s = useUpdateStore.getState().status;
  return [s.kind];
}

beforeEach(() => {
  useUpdateStore.getState().reset();
});

describe('update store transitions', () => {
  it('starts idle', () => {
    expect(statusKinds()).toEqual(['idle']);
  });

  it('auto check is silent at launch: no transient checking state', async () => {
    const ports = deferredPorts(async () => ({ version: '1.1.0', body: 'Notes here' }));
    const done = useUpdateStore.getState().autoCheck(NOW_MS, ports);
    // While the silent launch check is in flight nothing visibly changes (FR-5.3).
    expect(statusKinds()).toEqual(['idle']);
    ports.release();
    await done;
    expect(useUpdateStore.getState().status).toEqual({
      kind: 'available',
      version: '1.1.0',
      notes: 'Notes here',
    });
  });

  it('auto check within 24h leaves status untouched', async () => {
    useUpdateStore.setState({
      status: { kind: 'latest' },
    });
    const ports = deferredPorts(async () => null);
    // Stored timestamp 1h ago → skipped without touching upstream.
    const throttled: UpdatePorts = {
      ...ports,
      readLastCheck: async () => String(NOW_MS - HOUR_MS),
    };
    await useUpdateStore.getState().autoCheck(NOW_MS, throttled);
    expect(statusKinds()).toEqual(['latest']);
  });

  it('manual check: idle → checking → latest', async () => {
    const ports = deferredPorts(async () => null);
    const done = useUpdateStore.getState().manualCheck(NOW_MS, ports);
    expect(statusKinds()).toEqual(['checking']);
    ports.release();
    await done;
    expect(useUpdateStore.getState().status).toEqual({ kind: 'latest' });
  });

  it('manual check failure lands on error (silent, no throw)', async () => {
    const ports = deferredPorts(async () => {
      throw new Error('offline');
    });
    const done = useUpdateStore.getState().manualCheck(NOW_MS, ports);
    ports.release();
    await expect(done).resolves.toBeUndefined();
    expect(statusKinds()).toEqual(['error']);
  });

  it('a failed manual refresh does not clear a known available update', async () => {
    useUpdateStore.setState({
      status: { kind: 'available', version: '9.9.9', notes: null },
    });
    const ports = deferredPorts(async () => {
      throw new Error('flaky');
    });
    ports.release();
    await useUpdateStore.getState().manualCheck(NOW_MS, ports);
    expect(useUpdateStore.getState().status).toEqual({ kind: 'error' });
  });
});

describe('UpdateStatus kinds', () => {
  it('exposes exactly the spec statuses', () => {
    const kinds: UpdateStatus['kind'][] = ['idle', 'checking', 'available', 'latest', 'error'];
    expect(kinds).toHaveLength(5);
  });
});

describe('installUpdate (one-click restart-to-update)', () => {
  /** Ports whose installRemote blocks on a manual gate and counts calls. */
  function gatedInstallPorts(): UpdatePorts & { release: () => void; calls: () => number } {
    let resolveGate: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });
    let calls = 0;
    return {
      readLastCheck: async () => null,
      writeLastCheck: async () => {},
      fetchRemote: async () => null,
      installRemote: async () => {
        calls += 1;
        await gate;
      },
      release: () => resolveGate?.(),
      calls: () => calls,
    };
  }

  const AVAILABLE = { status: { kind: 'available', version: '1.1.0', notes: null } as const };

  it('is a no-op unless an update is available', async () => {
    const ports = gatedInstallPorts();
    await useUpdateStore.getState().installUpdate(ports);
    expect(ports.calls()).toBe(0);
    expect(useUpdateStore.getState().installing).toBe(false);
  });

  it('installs then relaunches, keeping installing set while the process exits', async () => {
    useUpdateStore.setState(AVAILABLE);
    const ports = gatedInstallPorts();
    const done = useUpdateStore.getState().installUpdate(ports);
    expect(useUpdateStore.getState().installing).toBe(true);
    ports.release();
    await done;
    expect(ports.calls()).toBe(1);
    expect(useUpdateStore.getState().status).toEqual(AVAILABLE.status);
    // Success path ends at relaunch — installing stays set as the app quits.
    expect(useUpdateStore.getState().installing).toBe(true);
  });

  it('failure clears installing and lands on error so the user can retry', async () => {
    useUpdateStore.setState(AVAILABLE);
    const failing: UpdatePorts = {
      ...gatedInstallPorts(),
      installRemote: async () => {
        throw new Error('download failed');
      },
    };
    await useUpdateStore.getState().installUpdate(failing);
    expect(useUpdateStore.getState().installing).toBe(false);
    expect(statusKinds()).toEqual(['error']);
  });

  it('reset clears the installing flag', () => {
    useUpdateStore.setState({ installing: true });
    useUpdateStore.getState().reset();
    expect(useUpdateStore.getState().installing).toBe(false);
  });
});
