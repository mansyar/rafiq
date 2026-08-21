import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  CALCULATION_METHODS,
  type CalculationMethod,
  DEFAULT_CALCULATION_METHOD,
  getCalculationMethod,
  setCalculationMethod,
} from '@/lib/prayer';

/**
 * Calculation-method step: all seven methods with Muslim World League
 * preselected (the app default). Persists immediately via the existing
 * prayer settings command and invalidates dependent queries.
 */
export function MethodStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const methodQuery = useQuery({
    queryKey: ['prayer-method'],
    queryFn: getCalculationMethod,
  });

  const methodMutation = useMutation({
    mutationFn: (m: CalculationMethod) => setCalculationMethod(m),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prayer-method'] });
      await queryClient.invalidateQueries({ queryKey: ['prayer-times'] });
    },
  });

  const active = methodQuery.data ?? DEFAULT_CALCULATION_METHOD;

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-3xl font-semibold">{t('onboarding.method.title')}</h1>
        <p className="text-muted-foreground">{t('onboarding.method.subtitle')}</p>
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-2">
        {CALCULATION_METHODS.map((m) => {
          const isActive = active === m;
          return (
            <Button
              key={m}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              aria-pressed={isActive}
              disabled={methodQuery.isLoading || methodMutation.isPending}
              onClick={() => methodMutation.mutate(m)}
            >
              {t(`settings.methods.${m}` as const)}
            </Button>
          );
        })}
      </div>

      {methodMutation.isError && (
        <p className="text-xs text-destructive" role="alert">
          {String(methodMutation.error)}
        </p>
      )}
    </div>
  );
}
