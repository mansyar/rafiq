import { describe, expect, it } from 'vitest';

import {
  DAILY_CONTENT_QUERY_KEY,
  type DailyAyah,
  type DailyHadith,
  formatAyahReference,
  getHadithTranslation,
} from './daily';

const ayah: DailyAyah = {
  id: '76:24',
  surah_id: 76,
  ayah_number: 24,
  arabic: 'فَاصْبِرْ لِحُكْمِ رَبِّكَ',
  translation: 'So be patient for the decision of your Lord.',
  surah_name_en: 'Al-Insan',
  surah_name_ar: 'الإنسان',
};

const hadith: DailyHadith = {
  id: '1',
  arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
  en: 'Actions are judged by intentions.',
  id_translation: 'Sesungguhnya amalan itu tergantung niatnya.',
  source: 'Nawawi 40 · Hadith 1 (Bukhari & Muslim)',
};

describe('daily helpers', () => {
  it('formats ayah reference as SurahName surah:ayah', () => {
    expect(formatAyahReference(ayah)).toBe('Al-Insan 76:24');
  });

  it('picks English hadith translation for en locale', () => {
    expect(getHadithTranslation(hadith, 'en')).toBe(hadith.en);
    expect(getHadithTranslation(hadith, 'en-US')).toBe(hadith.en);
  });

  it('picks Indonesian translation for id locale variants', () => {
    expect(getHadithTranslation(hadith, 'id')).toBe(hadith.id_translation);
    expect(getHadithTranslation(hadith, 'id-ID')).toBe(hadith.id_translation);
    expect(getHadithTranslation(hadith, 'id-x')).toBe(hadith.id_translation);
  });

  it('exposes DAILY_CONTENT_QUERY_KEY', () => {
    expect(DAILY_CONTENT_QUERY_KEY).toEqual(['daily-content']);
  });
});
