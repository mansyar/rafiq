import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef, useState } from 'react';
import adhanSrc from '@/assets/audio/adhan.mp3';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [canPlay, setCanPlay] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onCanPlay = () => setCanPlay(true);
    audio.addEventListener('canplaythrough', onCanPlay);
    return () => audio.removeEventListener('canplaythrough', onCanPlay);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      // Preload is handled by <audio preload="auto">, but also ensure the Tauri
      // event listener is registered for scheduler emissions.
      unlisten = await listen<PrayerTimeEvent['payload']>('prayer-time', async () => {
        try {
          const notificationEnabled = await getNotificationEnabled();
          const adhanEnabled = await getAdhanEnabled();
          // Only play when both toggles are enabled (per spec AC-7).
          if (!notificationEnabled || !adhanEnabled) return;
          const audio = audioRef.current;
          if (!audio) return;
          // Reset and play — WebView autoplay is enabled via
          // additionalBrowserArgs in tauri.conf.json.
          audio.currentTime = 0;
          const p = audio.play();
          if (p && typeof (p as Promise<void>).catch === 'function') {
            (p as Promise<void>).catch(() => {
              // Autoplay may still be blocked until first user gesture on some
              // platforms; swallow — next prayer will retry.
            });
          }
        } catch {
          // Settings unavailable (e.g. browser preview) — attempt play anyway.
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = 0;
          void audio.play().catch(() => {});
        }
      });
    }

    void setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
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
  );
}
