import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SLIDES = ['prayer', 'quran', 'log'] as const;

/** Eight-pointed star (khatam) motif drawn with two rotated squares. */
function StarMotif() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="mx-auto h-12 w-12 text-amber-500/60 dark:text-amber-400/50"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="10" y="10" width="28" height="28" />
      <rect x="10" y="10" width="28" height="28" transform="rotate(45 24 24)" />
      <circle cx="24" cy="24" r="4" className="text-emerald-600/60 dark:text-emerald-400/50" />
    </svg>
  );
}

/**
 * Welcome step: a three-slide feature mini-carousel (prayer times & adhan,
 * Quran & recitation, prayer log & analytics) with dot indicators and
 * arrow-key navigation while focus is inside the carousel.
 */
export function WelcomeStep() {
  const { t } = useTranslation();
  const [slide, setSlide] = useState<(typeof SLIDES)[number]>('prayer');

  function handleKeyDown(e: React.KeyboardEvent) {
    const index = SLIDES.indexOf(slide);
    if (e.key === 'ArrowRight') setSlide(SLIDES[Math.min(index + 1, SLIDES.length - 1)]);
    if (e.key === 'ArrowLeft') setSlide(SLIDES[Math.max(index - 1, 0)]);
  }

  return (
    <div className="flex flex-1 flex-col items-center space-y-6 text-center">
      <h1 className="font-heading text-3xl font-semibold">{t('onboarding.welcome.title')}</h1>
      <p className="text-muted-foreground">{t('onboarding.welcome.subtitle')}</p>

      <section
        aria-roledescription="carousel"
        aria-label={t('onboarding.welcome.title')}
        onKeyDown={handleKeyDown}
        className="flex w-full flex-1 flex-col items-center justify-center gap-6 rounded-lg border bg-card p-8"
      >
        <StarMotif />
        <div aria-live="polite" className="space-y-2">
          <h2 className="text-xl font-medium">
            {t(`onboarding.welcome.slides.${slide}.title` as const)}
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {t(`onboarding.welcome.slides.${slide}.description` as const)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {SLIDES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={t('onboarding.welcome.goToSlide', {
                slide: SLIDES.indexOf(s) + 1,
              })}
              aria-current={slide === s}
              onClick={() => setSlide(s)}
              className={`h-2 rounded-full transition-all ${
                slide === s
                  ? 'w-6 bg-emerald-600 dark:bg-emerald-400'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
