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

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Local YYYY-MM-DD strings for the retroactive logging window:
 * `count` days ending today, oldest first (last element = today).
 */
export function logWindowDates(count = 7, now = new Date()): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dates.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return dates;
}

/** Cell state for the 7-day grid: the stored status, or 'missed' when unlogged. */
export function prayerStatus(
  entries: readonly LogEntry[],
  date: string,
  prayer: LoggablePrayer,
): 'on_time' | 'qada' | 'missed' {
  const entry = entries.find((e) => e.log_date === date && e.prayer === prayer);
  return entry ? entry.status : 'missed';
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
