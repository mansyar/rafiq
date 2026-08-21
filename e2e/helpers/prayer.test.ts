import { describe, expect, it, vi } from 'vitest';
import { assertValidPrayer, normalizePrayer, triggerTestPrayer, VALID_PRAYERS } from './prayer';

function mockPage(evaluateImpl?: (fn: unknown, arg: unknown) => unknown) {
  return {
    evaluate: vi.fn(
      evaluateImpl ?? (async () => ({ prayer: 'fajr', time: '2026-01-01T00:00:00Z' })),
    ),
    getByText: vi.fn(() => ({ first: () => ({ waitFor: vi.fn(async () => undefined) }) })),
    waitForTimeout: vi.fn(async () => undefined),
  } as unknown as import('@playwright/test').Page;
}

describe('prayer helpers', () => {
  it('VALID_PRAYERS is the 5 prayers', () => {
    expect([...VALID_PRAYERS]).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });

  it('normalizePrayer is case-insensitive and canonicalizes', () => {
    expect(normalizePrayer('fajr')).toBe('Fajr');
    expect(normalizePrayer('FAJR')).toBe('Fajr');
    expect(normalizePrayer('  Dhuhr ')).toBe('Dhuhr');
    expect(normalizePrayer('asr')).toBe('Asr');
    expect(normalizePrayer('MAGHRIB')).toBe('Maghrib');
    expect(normalizePrayer('isha')).toBe('Isha');
  });

  it('normalizePrayer rejects empty and unknown', () => {
    expect(() => normalizePrayer('')).toThrow(/prayer is required/i);
    expect(() => normalizePrayer('   ')).toThrow(/prayer/i);
    expect(() => normalizePrayer('sunrise')).toThrow(/unknown prayer/i);
    expect(() => normalizePrayer('jumuah')).toThrow(/unknown prayer/i);
  });

  it('assertValidPrayer delegates to normalizePrayer', () => {
    expect(assertValidPrayer('Fajr')).toBe('Fajr');
    expect(() => assertValidPrayer('bad')).toThrow(/unknown prayer/i);
  });

  it('triggerTestPrayer validates and forwards lower-case to invoke', async () => {
    const evaluate = vi.fn(async (_fn, arg: unknown) => ({
      prayer: (arg as { args: { prayer: string } }).args.prayer,
      time: '2026-01-01T00:00:00Z',
    }));
    const page = mockPage(evaluate);
    await expect(triggerTestPrayer(page, 'bad')).rejects.toThrow(/unknown prayer/i);
    expect(evaluate).not.toHaveBeenCalled();
    const res = await triggerTestPrayer(page, 'Fajr');
    expect(evaluate).toHaveBeenCalledTimes(1);
    const [, arg] = evaluate.mock.calls[0] as [
      unknown,
      { command: string; args: { prayer: string } },
    ];
    expect(arg.command).toBe('trigger_test_prayer');
    expect(arg.args.prayer).toBe('fajr');
    expect(res.prayer).toBe('fajr');
  });

  it('triggerTestPrayer accepts any case', async () => {
    const page = mockPage(async (_fn, arg: unknown) => ({
      prayer: (arg as { args: { prayer: string } }).args.prayer,
      time: 'x',
    }));
    await expect(triggerTestPrayer(page, 'DHUHR')).resolves.toBeDefined();
    await expect(triggerTestPrayer(page, 'asr')).resolves.toBeDefined();
  });
});
