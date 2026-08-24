import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import id from '@/i18n/locales/id.json';
import { DEFAULT_LOCALE, resolveLocale, SUPPORTED_LOCALES } from './locale';

/** Flatten a catalog into leaf `path -> string` entries (arrays become .N leaves). */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, path));
    } else {
      out[path] = String(v);
    }
  }
  return out;
}

const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('resolveLocale', () => {
  it('accepts a valid persisted locale', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('id')).toBe('id');
  });

  it('falls back to the default locale for missing values', () => {
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it('falls back to the default locale for invalid values', () => {
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('EN')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(42)).toBe(DEFAULT_LOCALE);
  });

  it('enumerates the supported locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'id']);
  });
});

describe('i18n catalog parity (AC-7)', () => {
  const enFlat = flatten(en);
  const idFlat = flatten(id);

  it('en and id expose identical key paths', () => {
    expect(Object.keys(idFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it('shared keys interpolate the same placeholder tokens', () => {
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(idFlat[key]), `placeholder mismatch at ${key}`).toEqual(
        placeholders(enFlat[key]),
      );
    }
  });
});
