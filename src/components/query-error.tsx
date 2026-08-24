// Shared error surface (track ux-resilience_20260825): renders a localized
// message with a manual Retry affordance for any query/mutation failure.
// Callers pass an already-localized `message` (e.g. t('today.error', …)) and
// wire `onRetry` to the query's refetch(); `retrying` disables the button
// while a refetch is in flight so double-clicks are ignored.

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryErrorProps {
  /** Localized, user-facing error message. */
  message: string;
  /** Re-run the failed operation (typically `query.refetch`). */
  onRetry: () => void;
  /** True while a retry is in flight — disables the button. */
  retrying?: boolean;
  className?: string;
}

export function QueryError({ message, onRetry, retrying = false, className }: QueryErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive',
        className,
      )}
    >
      <p>{message}</p>
      <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
        {retrying ? t('common.retrying') : t('common.retry')}
      </Button>
    </div>
  );
}
