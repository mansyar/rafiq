import { describe, expect, it } from 'vitest';

import {
  DEFAULT_QURAN_TRANSLATION,
  isQuranTranslation,
  QURAN_TRANSLATIONS,
  shouldShowBismillah,
  translationKey,
} from './quran';

describe('quran helpers', () => {
  it('recognizes valid translations', () => {
    expect(isQuranTranslation('sahih')).toBe(true);
    expect(isQuranTranslation('clear')).toBe(true);
    expect(isQuranTranslation('kemenag')).toBe(true);
  });

  it('rejects invalid translations', () => {
    expect(isQuranTranslation('invalid')).toBe(false);
    expect(isQuranTranslation('')).toBe(false);
    expect(isQuranTranslation(null)).toBe(false);
    expect(isQuranTranslation('SAHIH')).toBe(false);
  });

  it('exposes 3 translations with sahih default', () => {
    expect(QURAN_TRANSLATIONS).toHaveLength(3);
    expect(DEFAULT_QURAN_TRANSLATION).toBe('sahih');
  });

  it('maps translation to i18n key', () => {
    expect(translationKey('sahih')).toBe('quran.translations.sahih');
    expect(translationKey('clear')).toBe('quran.translations.clear');
  });

  it('shows bismillah except for Al-Fatiha (1) and At-Tawbah (9)', () => {
    expect(shouldShowBismillah(1)).toBe(false);
    expect(shouldShowBismillah(2)).toBe(true);
    expect(shouldShowBismillah(9)).toBe(false);
    expect(shouldShowBismillah(114)).toBe(true);
  });
});
