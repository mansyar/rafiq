import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LanguageStep } from '@/components/onboarding/language-step';
import { LocationStep } from '@/components/onboarding/location-step';
import { MethodStep } from '@/components/onboarding/method-step';
import { WelcomeStep } from '@/components/onboarding/welcome-step';
import { Button } from '@/components/ui/button';
import { nextStep, ONBOARDING_STEPS, type OnboardingStep, previousStep } from '@/lib/onboarding';
import { setSetting } from '@/lib/tauri';

const FIRST_STEP = ONBOARDING_STEPS[0];
const LAST_STEP = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];

/**
 * Full-screen first-run wizard shell: persistent Skip in the header, a step
 * progress indicator, and Back/Next navigation across `ONBOARDING_STEPS`.
 * Individual step content is rendered inside `<main>`.
 */
export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<OnboardingStep>(FIRST_STEP);

  const currentIndex = ONBOARDING_STEPS.indexOf(step);
  const isLast = step === LAST_STEP;

  /** Persists the completion flag, syncs the guard query cache, and exits. */
  async function complete() {
    try {
      await setSetting('onboarding_complete', 'true');
    } catch {
      // Persistence unavailable (e.g. browser dev); still exit the wizard.
    }
    queryClient.setQueryData(['setting', 'onboarding_complete'], 'true');
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-medium text-muted-foreground">
          {t('onboarding.stepOf', {
            current: currentIndex + 1,
            total: ONBOARDING_STEPS.length,
          })}
        </span>
        <Button variant="ghost" size="sm" onClick={() => void complete()}>
          {t('onboarding.skip')}
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-6">
        {step === 'welcome' && <WelcomeStep />}
        {step === 'language' && <LanguageStep />}
        {step === 'location' && <LocationStep />}
        {step === 'method' && <MethodStep />}
      </main>

      <footer className="flex items-center justify-between px-6 py-4">
        <Button
          variant="ghost"
          disabled={step === FIRST_STEP}
          onClick={() => setStep((s) => previousStep(s) ?? s)}
        >
          {t('onboarding.back')}
        </Button>
        {isLast ? (
          <Button onClick={() => void complete()}>{t('onboarding.finish')}</Button>
        ) : (
          <Button onClick={() => setStep((s) => nextStep(s) ?? s)}>{t('onboarding.next')}</Button>
        )}
      </footer>
    </div>
  );
}
