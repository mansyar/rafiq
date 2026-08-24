import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { todayDateString } from '@/lib/prayer';
import { getQuranTranslation } from '@/lib/quran';

// ── Types mirrored from Rust (src-tauri/src/daily/mod.rs) ────────────────

export interface DailyAyah {
  id: string;
  surah_id: number;
  ayah_number: number;
  arabic: string;
  translation: string;
  surah_name_en: string;
  surah_name_ar: string;
}

export interface DailyHadith {
  id: string;
  arabic: string;
  en: string;
  id_translation: string;
  source: string;
}

export interface EventOverride {
  event_id: string;
  ayah: DailyAyah;
  hadith: DailyHadith;
}

export interface DailyContent {
  date: string;
  ayah: DailyAyah;
  hadith: DailyHadith;
  /** Present only on a bundled observance day (spec FR-5); omitted otherwise. */
  event?: EventOverride;
}

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

export async function getDailyContent(): Promise<DailyContent> {
  return invoke<DailyContent>('get_daily_content');
}

// ── TanStack Query helpers ────────────────────────────────────────────────

// justified: as const narrows QueryKey to readonly tuple for TanStack type safety per TS guide
export const DAILY_CONTENT_QUERY_KEY = ['daily-content'] as const;

/**
 * Typed hook for Today's daily ayah + hadith.
 *
 * - Re-resolves on local date rollover (queryKey includes `todayDateString()`,
 *   same mechanism as `useTodayQuery`).
 * - Invalidated on `quran_translation` change — queryKey includes the
 *   translation value (mirroring how `QuranReader` invalidates
 *   `['quran-translation']`; translation is fetched via `getQuranTranslation`
 *   and composed into the daily key so a change naturally refetches).
 */
export function useDailyContent() {
  const date = todayDateString();

  const translationQuery = useQuery({
    queryKey: ['quran-translation'],
    queryFn: getQuranTranslation,
    staleTime: 1000 * 60 * 60,
  });

  const dailyQuery = useQuery({
    // justified: as const preserves tuple branding required by useQuery queryKey
    queryKey: [...DAILY_CONTENT_QUERY_KEY, date, translationQuery.data] as const,
    queryFn: getDailyContent,
    staleTime: 1000 * 60 * 60,
    // Wait for translation attempt so first fetch uses resolved setting;
    // if translation load fails we still show daily content (fallback = sahih).
    enabled: !translationQuery.isLoading,
  });

  return dailyQuery;
}

// ── Helpers (logic-bearing, trivial) ──────────────────────────────────────

/** Picks the locale-appropriate hadith translation (EN vs ID). */
export function getHadithTranslation(hadith: DailyHadith, locale: string): string {
  return locale.startsWith('id') ? hadith.id_translation : hadith.en;
}

/** Human reference like "Al-Insan 76:24" from a DailyAyah. */
export function formatAyahReference(ayah: DailyAyah): string {
  return `${ayah.surah_name_en} ${ayah.surah_id}:${ayah.ayah_number}`;
}
