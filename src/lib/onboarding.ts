import type { Locale } from './locale';
import { DEFAULT_LOCALE } from './locale';

/** Ordered wizard steps for the first-run onboarding flow. */
export const ONBOARDING_STEPS = ['welcome', 'language', 'location', 'method'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** True when the persisted `onboarding_complete` flag marks onboarding as done. */
export function isOnboardingComplete(value: string | null | undefined): boolean {
  return value === 'true';
}

/**
 * Maps an OS language tag (e.g. `navigator.language`) to a supported locale.
 * Any `id*` tag selects Indonesian; everything else falls back to English.
 */
export function detectSystemLocale(tag: string | null | undefined): Locale {
  if (typeof tag === 'string' && tag.toLowerCase().startsWith('id')) {
    return 'id';
  }
  return DEFAULT_LOCALE;
}

/** Returns the step after `step`, or `null` when `step` is the final step. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] ?? null;
}

/** Returns the step before `step`, or `null` when `step` is the first step. */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}
