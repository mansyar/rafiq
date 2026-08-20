import { invoke } from '@tauri-apps/api/core';

// ── Types mirrored from Rust ──────────────────────────────────────────────

export type QuranTranslation = 'sahih' | 'clear' | 'kemenag';

export const QURAN_TRANSLATIONS: readonly QuranTranslation[] = [
  'sahih',
  'clear',
  'kemenag',
] as const;

export const DEFAULT_QURAN_TRANSLATION: QuranTranslation = 'sahih';

export interface Ayah {
  number: number;
  arabic: string;
  sahih: string;
  clear: string;
  kemenag: string;
}

export interface Surah {
  id: number;
  name_ar: string;
  name_transliteration: string;
  name_en: string;
  name_id: string;
  ayah_count: number;
  revelation_type: string;
  ayahs: Ayah[];
}

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

export async function listSurahs(): Promise<Surah[]> {
  return invoke<Surah[]>('list_surahs');
}

export async function getSurah(id: number): Promise<Surah> {
  return invoke<Surah>('get_surah', { id });
}

export async function searchSurahs(query: string, limit?: number): Promise<Surah[]> {
  return invoke<Surah[]>('search_surahs', { query, limit: limit ?? null });
}

export async function getQuranTranslation(): Promise<QuranTranslation> {
  return invoke<QuranTranslation>('get_quran_translation');
}

export async function setQuranTranslation(translation: QuranTranslation): Promise<void> {
  await invoke('set_quran_translation', { translation });
}

// ── Helpers (logic-bearing, unit-tested) ───────────────────────────────────

/**
 * Lightweight runtime check for translation.
 * Justification: persisted `quran_translation` is an untrusted string from storage.
 */
export function isQuranTranslation(value: unknown): value is QuranTranslation {
  return typeof value === 'string' && (QURAN_TRANSLATIONS as readonly string[]).includes(value);
}

/**
 * Returns display label for translation — delegates to i18n key `quran.translations.<key>`.
 */
export function translationKey(translation: QuranTranslation): string {
  return `quran.translations.${translation}`;
}

/**
 * True when a separate Bismillah header should be rendered.
 * FR-1.3: Tanzil includes Bismillah in 1:1 text, so surah 1 must not get a
 * duplicate header; At-Tawbah (9) has no Bismillah at all.
 */
export function shouldShowBismillah(surahId: number): boolean {
  return surahId !== 1 && surahId !== 9;
}

/**
 * Normalizes Arabic for search in UI tests — trims and lower not needed, but strips diacritics? Keep simple.
 */
export function formatAyahNumber(num: number): string {
  return String(num);
}
