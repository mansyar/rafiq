//! Update-check logic (FR-5.3/FR-5.4): a silent once-per-launch check gated by
//! a persisted 24h minimum interval, plus a user-initiated check for Settings.
//! All effects go through injectable {@link UpdatePorts} so tests use plain
//! fakes and production wires to the Rust settings store + updater plugin.

import { check } from '@tauri-apps/plugin-updater';
import { getSetting, setSetting } from './tauri';

/** Settings key persisting the epoch-ms of the last update-check attempt. */
export const LAST_CHECK_KEY = 'updater_last_check_at';

/** Minimum interval between silent launch checks (24h). */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** An update advertised by the release channel (mirrors the feed shape). */
export interface RemoteUpdate {
  version: string;
  /** Release notes; may be absent. */
  body?: string | null;
}

/** Outcome of one check attempt (or of a throttled skip). */
export type CheckOutcome =
  | { status: 'skipped' }
  | { status: 'available'; version: string; notes: string | null }
  | { status: 'latest' }
  | { status: 'error' };

/** Effects needed by the check logic; faked in tests, real via Tauri in app. */
export interface UpdatePorts {
  readLastCheck(): Promise<string | null>;
  writeLastCheck(ms: number): Promise<void>;
  /** Resolves `null` when already up-to-date; rejects on network errors. */
  fetchRemote(): Promise<RemoteUpdate | null>;
}

/**
 * Parses a stored timestamp. Garbage, fractions, and negatives read as
 * never-checked (`null`) so a corrupted row can never wedge the updater off.
 */
export function parseLastCheck(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
}

/** True when at least `intervalMs` has elapsed since the last check. */
export function isCheckDue(
  lastCheckMs: number | null,
  nowMs: number,
  intervalMs: number = CHECK_INTERVAL_MS,
): boolean {
  return lastCheckMs === null || nowMs - lastCheckMs >= intervalMs;
}

/**
 * Runs one upstream attempt, persisting the attempt time on every terminal
 * outcome — including errors, so an offline machine does not re-attempt on
 * every launch within the interval. Never throws (FR-5.4 silent degradation).
 */
async function performCheck(ports: UpdatePorts, nowMs: number): Promise<CheckOutcome> {
  try {
    const remote = await ports.fetchRemote();
    await ports.writeLastCheck(nowMs);
    return remote === null
      ? { status: 'latest' }
      : { status: 'available', version: remote.version, notes: remote.body ?? null };
  } catch {
    // Offline or backend hiccup: degrade silently (FR-5.4); persistence is
    // best-effort and its own failure must not surface either.
    try {
      await ports.writeLastCheck(nowMs);
    } catch {
      // ignored by design
    }
    return { status: 'error' };
  }
}

/**
 * Silent once-per-launch check (FR-5.3). Honours the persisted 24h minimum
 * interval; returns `{status: 'skipped'}` without touching upstream otherwise.
 */
export async function runStartupUpdateCheck(
  ports: UpdatePorts,
  nowMs: number,
): Promise<CheckOutcome> {
  const last = parseLastCheck(await ports.readLastCheck());
  if (!isCheckDue(last, nowMs)) {
    return { status: 'skipped' };
  }
  return performCheck(ports, nowMs);
}

/**
 * User-initiated check (Settings row). Bypasses the interval throttle but
 * still records the attempt time.
 */
export async function checkForUpdates(ports: UpdatePorts, nowMs: number): Promise<CheckOutcome> {
  return performCheck(ports, nowMs);
}

/** Production ports wired to the Rust settings store + updater plugin. */
export const tauriUpdatePorts: UpdatePorts = {
  readLastCheck: () => getSetting(LAST_CHECK_KEY),
  writeLastCheck: (ms) => setSetting(LAST_CHECK_KEY, String(ms)),
  fetchRemote: async () => {
    // Resolves `null` when the release channel has nothing newer.
    const update = await check();
    return update ? { version: update.version, body: update.body ?? null } : null;
  },
};
