import { invoke } from '@tauri-apps/api/core';

/** Cache footprint of one surah, as reported by the Rust audio index. */
export interface SurahCacheEntry {
  surah_id: number;
  /** Number of cached ayahs in this surah. */
  ayah_count: number;
  size_bytes: number;
}

/** Whole-index cache footprint grouped by surah. */
export interface RecitationCacheSummary {
  total_bytes: number;
  surahs: SurahCacheEntry[];
}

export function getRecitationCacheSummary(): Promise<RecitationCacheSummary> {
  return invoke('get_recitation_cache_summary');
}

/** `surahId` omitted deletes the whole cache; returns freed bytes. */
export function deleteRecitationCache(surahId?: number): Promise<number> {
  return invoke('delete_recitation_cache', { surahId: surahId ?? null });
}

const KB = 1024;
const MB = 1024 * 1024;

const LOCALE_TAGS = { en: 'en', id: 'id' } as const;

/**
 * Human-readable cache size (FR-5). Byte values stay exact; larger units use
 * up to one fraction digit and the locale's decimal separator.
 */
export function formatCacheSize(bytes: number, locale: 'en' | 'id'): string {
  if (bytes < KB) {
    return `${bytes} B`;
  }
  const [unit, value] = bytes < MB ? (['KB', bytes / KB] as const) : (['MB', bytes / MB] as const);
  const formatted = new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${unit}`;
}
