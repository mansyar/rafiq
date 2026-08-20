import { describe, expect, it } from 'vitest';
import {
  formatPrayerTime,
  getNextPrayer,
  isCalculationMethod,
  isPast,
  type PrayerTimes,
  todayDateString,
} from './prayer';

function times(): PrayerTimes {
  // Raleigh, 2015-07-12 — UTC instants (from Rust fixture, trimmed for tests)
  return {
    fajr: '2015-07-12T09:33:00Z',
    sunrise: '2015-07-12T10:07:00Z',
    dhuhr: '2015-07-12T17:30:00Z',
    asr: '2015-07-12T21:20:00Z',
    maghrib: '2015-07-13T00:47:00Z', // note next day UTC because local evening lands after midnight UTC
    isha: '2015-07-13T02:07:00Z',
  } as unknown as PrayerTimes;
}

// Use a single-day UTC set for clearer next-prayer tests
function simpleDay(): PrayerTimes {
  return {
    fajr: '2025-08-20T02:00:00Z',
    sunrise: '2025-08-20T03:00:00Z',
    dhuhr: '2025-08-20T04:00:00Z',
    asr: '2025-08-20T06:00:00Z',
    maghrib: '2025-08-20T08:00:00Z',
    isha: '2025-08-20T09:00:00Z',
  };
}

describe('todayDateString', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    const d = new Date(2025, 7, 20); // 2025-08-20 local (month 0-based)
    expect(todayDateString(d)).toBe('2025-08-20');
  });

  it('pads single-digit months and days', () => {
    expect(todayDateString(new Date(2025, 0, 5))).toBe('2025-01-05');
  });
});

describe('formatPrayerTime', () => {
  it('returns HH:mm for a valid UTC instant', () => {
    // In UTC environment, 09:33Z should format as 09:33
    const out = formatPrayerTime('2015-07-12T09:33:00Z', 'en-GB');
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it('falls back to raw string for invalid input', () => {
    expect(formatPrayerTime('not-a-date')).toBe('not-a-date');
  });
});

describe('getNextPrayer', () => {
  it('returns the first prayer when now is before fajr', () => {
    const next = getNextPrayer(simpleDay(), new Date('2025-08-20T01:00:00Z'));
    expect(next).toEqual({ name: 'fajr', time: simpleDay().fajr });
  });

  it('returns dhuhr when now is after fajr but before dhuhr (sunrise excluded)', () => {
    const next = getNextPrayer(simpleDay(), new Date('2025-08-20T02:30:00Z'));
    expect(next?.name).toBe('dhuhr');
  });

  it('includes sunrise when requested', () => {
    const next = getNextPrayer(simpleDay(), new Date('2025-08-20T02:30:00Z'), {
      includeSunrise: true,
    });
    expect(next?.name).toBe('sunrise');
  });

  it('returns null when all prayers have passed', () => {
    const next = getNextPrayer(simpleDay(), new Date('2025-08-20T10:00:00Z'));
    expect(next).toBeNull();
  });

  it('advances through the day', () => {
    const day = simpleDay();
    expect(getNextPrayer(day, new Date('2025-08-20T03:30:00Z'))?.name).toBe('dhuhr');
    expect(getNextPrayer(day, new Date('2025-08-20T05:00:00Z'))?.name).toBe('asr');
    expect(getNextPrayer(day, new Date('2025-08-20T07:00:00Z'))?.name).toBe('maghrib');
    expect(getNextPrayer(day, new Date('2025-08-20T08:30:00Z'))?.name).toBe('isha');
  });

  it('handles the Raleigh fixture consistently', () => {
    const t = times();
    // Before sunrise, next (without sunrise) is dhuhr
    const beforeSunrise = getNextPrayer(t, new Date('2015-07-12T09:40:00Z'));
    expect(beforeSunrise?.name).toBe('dhuhr');
  });
});

describe('isPast', () => {
  it('detects past instants', () => {
    expect(isPast('2025-08-20T01:00:00Z', new Date('2025-08-20T02:00:00Z'))).toBe(true);
    expect(isPast('2025-08-20T03:00:00Z', new Date('2025-08-20T02:00:00Z'))).toBe(false);
  });
});

describe('isCalculationMethod', () => {
  it('accepts known methods', () => {
    expect(isCalculationMethod('muslim_world_league')).toBe(true);
    expect(isCalculationMethod('jafari')).toBe(true);
  });

  it('rejects unknown methods', () => {
    expect(isCalculationMethod('not-a-method')).toBe(false);
    expect(isCalculationMethod('MWL')).toBe(false);
    expect(isCalculationMethod(null)).toBe(false);
  });
});
