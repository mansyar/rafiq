import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import adhanSrc from '@/assets/audio/adhan.mp3';
import { Button } from '@/components/ui/button';
import { getAdhanEnabled, getNotificationEnabled } from '@/lib/prayer';

type PrayerTimeEvent = {
  payload: {
    prayer: string;
    time: string;
    method?: string;
  };
};

/**
 * Preloads the CC0 adhan tone and plays it when the Rust scheduler emits
 * a `prayer-time` event (via `app.emit`). Respects persisted toggles
 * `notification_enabled` / `adhan_enabled` (both default enabled).
 * No UI chrome — hidden <audio>.
 */
export function AdhanPlayer() {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [canPlay, setCanPlay] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onCanPlay = () => setCanPlay(true);
    audio.addEventListener('canplaythrough', onCanPlay);
    return () => audio.removeEventListener('canplaythrough', onCanPlay);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function attemptPlay() {
      const audio = audioRef.current;
      if (!audio) return;
      // Reset and play — WebView autoplay is enabled via
      // additionalBrowserArgs in tauri.conf.json.
      audio.currentTime = 0;
      try {
        await audio.play();
        setBlocked(false);
      } catch {
        // Autoplay may still be blocked until first user gesture on some
        // platforms; surface a dismissible notice — next prayer retries.
        setBlocked(true);
      }
    }

    async function setup() {
      // Preload is handled by <audio preload="auto">, but also ensure the Tauri
      // event listener is registered for scheduler emissions.
      unlisten = await listen<PrayerTimeEvent['payload']>('prayer-time', async () => {
        try {
          const notificationEnabled = await getNotificationEnabled();
          const adhanEnabled = await getAdhanEnabled();
          // Only play when both toggles are enabled (per spec AC-7).
          if (!notificationEnabled || !adhanEnabled) return;
          await attemptPlay();
        } catch {
          // Settings unavailable (e.g. browser preview) — attempt play anyway.
          await attemptPlay();
        }
      });
    }

    void setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <>
      <audio
        ref={audioRef}
        src={adhanSrc}
        preload="auto"
        // Hidden, no controls — programmatic playback only.
        style={{ display: 'none' }}
        data-testid="adhan-audio"
        data-canplay={canPlay ? 'true' : 'false'}
      >
        <track kind="captions" />
      </audio>
      {blocked && (
        <div role="status" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-background/95 px-4 py-2 text-sm shadow-lg">
            <p className="text-muted-foreground">{t('adhan.blockedNotice')}</p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setBlocked(false)}
              className="shrink-0 text-xs underline underline-offset-2"
            >
              {t('adhan.dismiss')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
