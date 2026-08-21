import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet } from 'react-router-dom';
import { isOnboardingComplete } from '@/lib/onboarding';
import { getSetting } from '@/lib/tauri';

/**
 * Blocks the main app until the first-run wizard is finished or skipped:
 * while `onboarding_complete` is absent/false, every guarded route redirects
 * to `/onboarding`. Renders nothing while the flag is being loaded.
 */
export function OnboardingGuard() {
  const { data, isPending } = useQuery({
    queryKey: ['setting', 'onboarding_complete'],
    queryFn: () => getSetting('onboarding_complete'),
  });

  if (isPending) {
    return null;
  }
  if (!isOnboardingComplete(data ?? null)) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
