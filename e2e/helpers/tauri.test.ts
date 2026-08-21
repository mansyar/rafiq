import { describe, expect, it, vi } from 'vitest';
import {
  getSettingViaInvoke,
  invokeTauri,
  JAKARTA_CITY_ID,
  JAKARTA_COORDS,
  setManualLocation,
  setTranslation,
  VALID_TRANSLATIONS,
} from './tauri';

// Minimal Page mock — only `evaluate` and `waitForFunction` are used by helpers.
function mockPage(evaluateImpl?: (fn: unknown, arg: unknown) => unknown) {
  return {
    evaluate: vi.fn(evaluateImpl ?? (async (_fn, _arg) => null)),
    waitForFunction: vi.fn(async () => undefined),
  } as unknown as import('@playwright/test').Page;
}

describe('tauri helpers (pure validation + invoke wiring)', () => {
  it('JAKARTA constants match bundled dataset', () => {
    expect(JAKARTA_CITY_ID).toBe('jakarta-id-1');
    expect(JAKARTA_COORDS.latitude).toBeCloseTo(-6.2088);
    expect(JAKARTA_COORDS.longitude).toBeCloseTo(106.8456);
    expect(JAKARTA_COORDS.timezone).toBe('Asia/Jakarta');
  });

  it('VALID_TRANSLATIONS is the 3 known values', () => {
    expect([...VALID_TRANSLATIONS].sort()).toEqual(['clear', 'kemenag', 'sahih'].sort());
  });

  it('invokeTauri rejects empty command without calling evaluate', async () => {
    const page = mockPage();
    await expect(invokeTauri(page, '')).rejects.toThrow(/command/i);
    await expect(invokeTauri(page, '   ')).rejects.toThrow(/command/i);
    expect(
      (page as unknown as { evaluate: ReturnType<typeof vi.fn> }).evaluate,
    ).not.toHaveBeenCalled();
  });

  it('invokeTauri forwards trimmed command and args to page.evaluate', async () => {
    const evaluate = vi.fn(async () => 'ok');
    const page = mockPage(evaluate);
    const res = await invokeTauri(page, '  get_setting  ', { key: 'locale' });
    expect(res).toBe('ok');
    expect(evaluate).toHaveBeenCalledTimes(1);
    const [, arg] = evaluate.mock.calls[0] as [unknown, { command: string; args: unknown }];
    expect(arg.command).toBe('get_setting');
    expect(arg.args).toEqual({ key: 'locale' });
  });

  it('setTranslation rejects unknown and normalizes case', async () => {
    const page = mockPage();
    await expect(setTranslation(page, 'bad')).rejects.toThrow(/unknown translation/i);
    await expect(setTranslation(page, '')).rejects.toThrow(/translation/i);
    // should accept case-insensitive
    const okPage = mockPage(async () => undefined);
    await expect(setTranslation(okPage, 'SAHIH')).resolves.toBeUndefined();
    await expect(setTranslation(okPage, 'Clear')).resolves.toBeUndefined();
    await expect(setTranslation(okPage, 'KEMENAG')).resolves.toBeUndefined();
  });

  it('setManualLocation rejects invalid coordinates', async () => {
    const page = mockPage();
    await expect(setManualLocation(page, 100, 0)).rejects.toThrow(/latitude/i);
    await expect(setManualLocation(page, 0, 200)).rejects.toThrow(/longitude/i);
    await expect(setManualLocation(page, Number.NaN, 0)).rejects.toThrow(/latitude/i);
    // valid
    const okPage = mockPage(async () => undefined);
    await expect(setManualLocation(okPage, -6.2, 106.8)).resolves.toBeUndefined();
    await expect(setManualLocation(okPage, 90, 180)).resolves.toBeUndefined();
  });

  it('getSettingViaInvoke rejects empty key', async () => {
    const page = mockPage();
    await expect(getSettingViaInvoke(page, '')).rejects.toThrow(/key/i);
    await expect(getSettingViaInvoke(page, '   ')).rejects.toThrow(/key/i);
  });
});
