export type Locale = 'en' | 'id';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'id'];

export const DEFAULT_LOCALE: Locale = 'en';

interface PageStrings {
  title: string;
  subtitle: string;
  body: string;
}

interface Strings {
  brand: string;
  tagline: string;
  nav: {
    today: string;
    quran: string;
    log: string;
    settings: string;
  };
  page: Record<'today' | 'quran' | 'log' | 'settings', PageStrings>;
}

export const STRINGS: Record<Locale, Strings> = {
  en: {
    brand: 'Rafiq',
    tagline: 'Muslim Companion',
    nav: { today: 'Today', quran: 'Quran', log: 'Log', settings: 'Settings' },
    page: {
      today: {
        title: 'Today',
        subtitle: 'Your daily practice',
        body: 'Prayer times, adhan, and your day at a glance will live here.',
      },
      quran: {
        title: 'Quran',
        subtitle: 'The noble Quran',
        body: 'Read and listen to the Quran. This view is coming soon.',
      },
      log: {
        title: 'Log',
        subtitle: 'Your practice history',
        body: 'Prayer logs and streaks will appear here.',
      },
      settings: {
        title: 'Settings',
        subtitle: 'Preferences',
        body: 'Language, calculation method, and notification settings will live here.',
      },
    },
  },
  id: {
    brand: 'Rafiq',
    tagline: 'Sahabat Muslim',
    nav: { today: 'Hari Ini', quran: 'Al-Qur\u2019an', log: 'Catatan', settings: 'Pengaturan' },
    page: {
      today: {
        title: 'Hari Ini',
        subtitle: 'Amalan harian Anda',
        body: 'Waktu salat, azan, dan ringkasan hari Anda akan tampil di sini.',
      },
      quran: {
        title: 'Al-Qur\u2019an',
        subtitle: 'Al-Qur\u2019an yang mulia',
        body: 'Baca dan dengarkan Al-Qur\u2019an. Tampilan ini segera hadir.',
      },
      log: {
        title: 'Catatan',
        subtitle: 'Riwayat amalan Anda',
        body: 'Catatan salat dan konsistensi akan tampil di sini.',
      },
      settings: {
        title: 'Pengaturan',
        subtitle: 'Preferensi',
        body: 'Bahasa, metode perhitungan, dan pengaturan notifikasi akan tampil di sini.',
      },
    },
  },
};

export function stringsFor(locale: Locale): Strings {
  return STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
}
