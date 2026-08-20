import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type GregorianDate,
  type HijriDate,
  hijriFromGregorian,
  hijriToGregorian,
} from '@/lib/hijri';

const INPUT_CLASS =
  'rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface G2HState {
  date: HijriDate | null;
  error: string | null;
}

interface H2GState {
  date: GregorianDate | null;
  error: string | null;
}

/**
 * Bidirectional Gregorian <-> Umm al-Qura converter (FR-3).
 * Reuses the same Tauri commands as the month view (single conversion path);
 * results are stored as date objects so they re-render with locale changes.
 */
export function DateConverter() {
  const { t } = useTranslation();
  const gregMonths = t('calendar.gregMonths') as unknown as string[];
  const [gregInput, setGregInput] = useState('');
  const [g2h, setG2h] = useState<G2HState>({ date: null, error: null });
  const [hYear, setHYear] = useState('');
  const [hMonth, setHMonth] = useState('');
  const [hDay, setHDay] = useState('');
  const [h2g, setH2g] = useState<H2GState>({ date: null, error: null });

  async function onGregorianChange(value: string) {
    setGregInput(value);
    if (!value) {
      setG2h({ date: null, error: null });
      return;
    }
    const [year, month, day] = value.split('-').map(Number);
    try {
      const date = await hijriFromGregorian(year, month, day);
      setG2h({ date, error: null });
    } catch (e) {
      setG2h({ date: null, error: (e as Error).message });
    }
  }

  async function convertHijri(year: string, month: string, day: string) {
    if (!year || !month || !day) {
      setH2g({ date: null, error: null });
      return;
    }
    try {
      const date = await hijriToGregorian(Number(year), Number(month), Number(day));
      setH2g({ date, error: null });
    } catch (e) {
      setH2g({ date: null, error: (e as Error).message });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">{t('calendar.converter.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          <section aria-label={t('calendar.converter.gregorianToHijri')}>
            <h3 className="text-sm font-medium">{t('calendar.converter.gregorianToHijri')}</h3>
            <label htmlFor="converter-gregorian" className="sr-only">
              {t('calendar.converter.gregorianDate')}
            </label>
            <input
              id="converter-gregorian"
              type="date"
              className={`${INPUT_CLASS} mt-2 w-full`}
              value={gregInput}
              onChange={(e) => onGregorianChange(e.target.value)}
            />
            {g2h.error && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {t('calendar.converter.invalid', { message: g2h.error })}
              </p>
            )}
            {g2h.date && (
              <p className="mt-2 text-sm text-gold-700 dark:text-gold-300">
                {g2h.date.day} {t(`calendar.months.${g2h.date.month}`)} {g2h.date.year}
              </p>
            )}
          </section>

          <section aria-label={t('calendar.converter.hijriToGregorian')}>
            <h3 className="text-sm font-medium">{t('calendar.converter.hijriToGregorian')}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                max={9999}
                aria-label={t('calendar.converter.hijriYear')}
                className={`${INPUT_CLASS} w-full`}
                value={hYear}
                placeholder={t('calendar.converter.hijriYear')}
                onChange={(e) => {
                  setHYear(e.target.value);
                  convertHijri(e.target.value, hMonth, hDay);
                }}
              />
              <input
                type="number"
                min={1}
                max={12}
                aria-label={t('calendar.converter.hijriMonth')}
                className={`${INPUT_CLASS} w-full`}
                value={hMonth}
                placeholder={t('calendar.converter.hijriMonth')}
                onChange={(e) => {
                  setHMonth(e.target.value);
                  convertHijri(hYear, e.target.value, hDay);
                }}
              />
              <input
                type="number"
                min={1}
                max={30}
                aria-label={t('calendar.converter.hijriDay')}
                className={`${INPUT_CLASS} w-full`}
                value={hDay}
                placeholder={t('calendar.converter.hijriDay')}
                onChange={(e) => {
                  setHDay(e.target.value);
                  convertHijri(hYear, hMonth, e.target.value);
                }}
              />
            </div>
            {h2g.error && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {t('calendar.converter.invalid', { message: h2g.error })}
              </p>
            )}
            {h2g.date && (
              <p className="mt-2 text-sm text-gold-700 dark:text-gold-300">
                {h2g.date.day} {gregMonths[h2g.date.month - 1]} {h2g.date.year}
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
