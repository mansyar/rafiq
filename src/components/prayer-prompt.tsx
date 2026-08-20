import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getPrayerLog, isLoggablePrayer, type LoggablePrayer, logPrayer } from '@/lib/log';
import { formatPrayerTime, getResolvedLocation, todayDateString } from '@/lib/prayer';

type PromptPhase = 'ask' | 'logged' | 'error';

interface PromptState {
  prayer: LoggablePrayer;
  /** RFC3339 UTC instant the prayer time fired. */
  time: string;
  phase: PromptPhase;
  needLocation: boolean;
}

/** How long an unanswered prompt stays visible before fading away. */
const ASK_TIMEOUT_MS = 10 * 60 * 1000;
/** How long the logged/error feedback lingers. */
const FEEDBACK_TIMEOUT_MS = 4000;

/**
 * Global prayer-time prompt. Listens for the scheduler's always-on
 * `prayer-fired` event and offers the one-tap "Prayed" action on any
 * screen — OS notifications cannot carry action buttons on desktop (see
 * spec amendment 2026-08-20). Skips the prompt when the prayer is already
 * logged today and suggests Settings when no location is set.
 * Deliberately unobtrusive: auto-dismisses, and a dismissed prayer is not
 * re-prompted for the rest of the session.
 */
export function PrayerPrompt() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const scheduleDismiss = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPrompt(null), ms);
  }, []);

  const dismiss = useCallback((prayer: LoggablePrayer) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    dismissedRef.current.add(prayer);
    setPrompt(null);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function showPrompt(prayer: LoggablePrayer, time: string) {
      const today = todayDateString();
      try {
        const entries = await getPrayerLog(today, today);
        if (entries.some((e) => e.prayer === prayer)) return; // already logged
        const resolved = await getResolvedLocation();
        setPrompt({ prayer, time, phase: 'ask', needLocation: !resolved });
        scheduleDismiss(ASK_TIMEOUT_MS);
      } catch {
        // Storage unavailable (e.g. browser preview) — stay quiet.
      }
    }

    async function setup() {
      unlisten = await listen<{ prayer: string; time: string }>('prayer-fired', (event) => {
        const { prayer, time } = event.payload;
        if (!isLoggablePrayer(prayer)) return;
        if (dismissedRef.current.has(prayer)) return;
        void showPrompt(prayer, time);
      });
    }

    void setup();
    return () => {
      if (unlisten) unlisten();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleDismiss]);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(prompt.prayer);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, dismiss]);

  async function handlePrayed() {
    if (prompt?.phase !== 'ask') return;
    try {
      // Tap moment is the logged_at — classification happens on the Rust side.
      await logPrayer(prompt.prayer, todayDateString());
      setPrompt({ ...prompt, phase: 'logged' });
      scheduleDismiss(FEEDBACK_TIMEOUT_MS);
    } catch {
      setPrompt({ ...prompt, phase: 'error' });
      scheduleDismiss(FEEDBACK_TIMEOUT_MS * 2);
    }
  }

  if (!prompt) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80" role="status" aria-live="polite">
      <Card size="sm" className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('log.prompt.title', { name: t(`prayer.${prompt.prayer}`) })}</CardTitle>
          <CardDescription>{formatPrayerTime(prompt.time)}</CardDescription>
        </CardHeader>
        {prompt.phase === 'ask' && !prompt.needLocation && (
          <CardContent>
            <Button className="w-full" onClick={() => void handlePrayed()}>
              {t('log.prompt.prayed')}
            </Button>
          </CardContent>
        )}
        {prompt.phase === 'ask' && prompt.needLocation && (
          <CardContent className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">{t('log.prompt.locationHint')}</p>
            <Button asChild variant="link" className="px-0">
              <Link to="/settings">{t('log.prompt.openSettings')}</Link>
            </Button>
          </CardContent>
        )}
        {prompt.phase === 'logged' && (
          <CardContent>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t('log.prompt.logged')}
            </p>
          </CardContent>
        )}
        {prompt.phase === 'error' && (
          <CardContent>
            <p className="text-sm text-destructive">{t('log.prompt.error')}</p>
          </CardContent>
        )}
        <CardFooter>
          <Button variant="ghost" size="xs" onClick={() => dismiss(prompt.prayer)}>
            {t('log.prompt.dismiss')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
