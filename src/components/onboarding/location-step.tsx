import { useTranslation } from 'react-i18next';
import { LocationPicker } from '@/components/location-picker';

/**
 * Location step of the wizard: reuses the shared LocationPicker
 * (debounced city search + manual coordinates). May be left empty —
 * prayer times simply stay unavailable until a location is set.
 */
export function LocationStep() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-3xl font-semibold">{t('onboarding.location.title')}</h1>
        <p className="text-muted-foreground">{t('onboarding.location.subtitle')}</p>
      </div>
      <LocationPicker idPrefix="onboarding" />
    </div>
  );
}
