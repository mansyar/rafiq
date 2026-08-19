import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, resolveLocale, SUPPORTED_LOCALES } from './locale';

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
