import { describe, expect, it } from 'vitest';
import {
  detectSystemLocale,
  isOnboardingComplete,
  nextStep,
  ONBOARDING_STEPS,
  previousStep,
} from './onboarding';

describe('isOnboardingComplete', () => {
  it('is true only for the exact persisted "true" flag', () => {
    expect(isOnboardingComplete('true')).toBe(true);
  });

  it('is false when the flag was never stored', () => {
    expect(isOnboardingComplete(null)).toBe(false);
    expect(isOnboardingComplete(undefined)).toBe(false);
  });

  it('is false for any other stored value', () => {
    expect(isOnboardingComplete('false')).toBe(false);
    expect(isOnboardingComplete('')).toBe(false);
    expect(isOnboardingComplete('TRUE')).toBe(false);
    expect(isOnboardingComplete('1')).toBe(false);
  });
});

describe('detectSystemLocale', () => {
  it('maps Indonesian system locales to Indonesian', () => {
    expect(detectSystemLocale('id')).toBe('id');
    expect(detectSystemLocale('id-ID')).toBe('id');
  });

  it('maps English and unrelated locales to English', () => {
    expect(detectSystemLocale('en')).toBe('en');
    expect(detectSystemLocale('en-US')).toBe('en');
    expect(detectSystemLocale('fr-FR')).toBe('en');
  });

  it('falls back to English for missing or malformed tags', () => {
    expect(detectSystemLocale(null)).toBe('en');
    expect(detectSystemLocale(undefined)).toBe('en');
    expect(detectSystemLocale('')).toBe('en');
  });
});

describe('wizard step machine', () => {
  it('defines the four ordered steps', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'language', 'location', 'method']);
  });

  it('advances forward and stops after the final step', () => {
    expect(nextStep('welcome')).toBe('language');
    expect(nextStep('language')).toBe('location');
    expect(nextStep('location')).toBe('method');
    expect(nextStep('method')).toBeNull();
  });

  it('goes back and stops before the first step', () => {
    expect(previousStep('method')).toBe('location');
    expect(previousStep('language')).toBe('welcome');
    expect(previousStep('welcome')).toBeNull();
  });
});
