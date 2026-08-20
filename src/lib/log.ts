import { invoke } from '@tauri-apps/api/core';

// ── Types mirrored from Rust ──────────────────────────────────────────────

/** The five obligatory prayers — the only loggable ones (sunrise excluded). */
export type LoggablePrayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const LOGGABLE_PRAYERS: readonly LoggablePrayer[] = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

export type LogStatus = 'on_time' | 'qada';

export interface LogEntry {
  /** Local calendar date the prayer belongs to (YYYY-MM-DD). */
  log_date: string;
  prayer: LoggablePrayer;
  /** Instant the prayer was logged (RFC3339 UTC). */
  logged_at: string;
  status: LogStatus;
}

export interface Streaks {
  current: number;
  best: number;
}

export interface MonthlySummary {
  days_elapsed: number;
  complete_days: number;
  completion_pct: number;
  on_time: number;
  qada: number;
  missed: number;
  on_time_pct: number;
  qada_pct: number;
  missed_pct: number;
}

export interface LogAnalytics {
  streaks: Streaks;
  month: MonthlySummary;
}

/** Type guard for prayer names arriving from scheduler events / user input. */
export function isLoggablePrayer(value: string): value is LoggablePrayer {
  return (LOGGABLE_PRAYERS as readonly string[]).includes(value);
}

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

/**
 * Logs a prayer. `loggedAt` (RFC3339 UTC) is the moment the user actually
 * acted (e.g. tapped "Prayed"); on-time vs qada is decided on the Rust side
 * at that instant. Defaults to now when omitted.
 */
export async function logPrayer(
  prayer: LoggablePrayer,
  logDate: string, // YYYY-MM-DD (local)
  loggedAt?: string,
): Promise<LogEntry> {
  return invoke<LogEntry>('log_prayer', {
    prayer,
    logDate,
    loggedAt: loggedAt ?? new Date().toISOString(),
  });
}

/** Deletes a log entry; resolves to the number of rows removed (0 or 1). */
export async function deleteLogEntry(logDate: string, prayer: LoggablePrayer): Promise<number> {
  return invoke<number>('delete_log_entry', { logDate, prayer });
}

/** Inclusive range query, ordered by date then prayer order. */
export async function getPrayerLog(from: string, to: string): Promise<LogEntry[]> {
  return invoke<LogEntry[]>('get_prayer_log', { from, to });
}

/** Streaks + current-month analytics for the local today. */
export async function getLogAnalytics(): Promise<LogAnalytics> {
  return invoke<LogAnalytics>('get_log_analytics');
}
