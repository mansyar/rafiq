import { describe, expect, it } from 'vitest';
import {
  isLoggablePrayer,
  LOGGABLE_PRAYERS,
  type LogEntry,
  logWindowDates,
  prayerStatus,
} from './log';

function entry(logDate: string, prayer: string, status: 'on_time' | 'qada' = 'on_time'): LogEntry {
  return {
    log_date: logDate,
    prayer: prayer as LogEntry['prayer'],
    logged_at: `${logDate}T12:00:00Z`,
    status,
  };
}

describe('isLoggablePrayer', () => {
  it('accepts the five obligatory prayers', () => {
    for (const prayer of LOGGABLE_PRAYERS) {
      expect(isLoggablePrayer(prayer)).toBe(true);
    }
  });

  it('rejects sunrise (non-obligatory) and unknown names', () => {
    expect(isLoggablePrayer('sunrise')).toBe(false);
    expect(isLoggablePrayer('midnight')).toBe(false);
    expect(isLoggablePrayer('')).toBe(false);
  });
});

describe('logWindowDates', () => {
  it('returns 7 local dates ending today, oldest first', () => {
    // 2026-08-20 (local), 03:00 — before today's first prayer window matters here
    expect(logWindowDates(7, new Date(2026, 7, 20, 3, 0))).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
  });

  it('rolls back across a month boundary', () => {
    expect(logWindowDates(7, new Date(2026, 7, 2, 12, 0))).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('respects a custom window size', () => {
    expect(logWindowDates(1, new Date(2026, 11, 31, 23, 59))).toEqual(['2026-12-31']);
  });
});

describe('prayerStatus', () => {
  it('returns the stored status for a logged (date, prayer)', () => {
    const entries = [entry('2026-08-20', 'fajr', 'on_time'), entry('2026-08-20', 'dhuhr', 'qada')];
    expect(prayerStatus(entries, '2026-08-20', 'fajr')).toBe('on_time');
    expect(prayerStatus(entries, '2026-08-20', 'dhuhr')).toBe('qada');
  });

  it('returns missed for unlogged cells and ignores other dates/prayers', () => {
    const entries = [entry('2026-08-19', 'fajr', 'on_time')];
    expect(prayerStatus(entries, '2026-08-20', 'fajr')).toBe('missed');
    expect(prayerStatus(entries, '2026-08-19', 'dhuhr')).toBe('missed');
    expect(prayerStatus([], '2026-08-20', 'isha')).toBe('missed');
  });
});
