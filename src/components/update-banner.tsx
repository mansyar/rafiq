//! Global updater surface (FR-5.3): runs the silent launch check once and,
//! when an update is available, offers a calm one-click "restart to update".

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUpdateStore } from '@/lib/update-store';

export function UpdateBanner() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const installing = useUpdateStore((s) => s.installing);
  const autoCheck = useUpdateStore((s) => s.autoCheck);
  const installUpdate = useUpdateStore((s) => s.installUpdate);

  // Silent once-per-launch check (24h minimum interval is persisted backend-side).
  useEffect(() => {
    void autoCheck();
  }, [autoCheck]);

  if (status.kind !== 'available' && !(status.kind === 'error' && status.retryInstall === true)) {
    return null;
  }

  if (status.kind === 'error') {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <Card
          role="status"
          className="w-full max-w-md border-destructive/40 shadow-lg dark:border-destructive/60"
        >
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium">{t('update.installFailed')}</p>
            </div>
            <Button variant="outline" disabled={installing} onClick={() => void installUpdate()}>
              {installing ? t('update.installing') : t('update.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <Card
        role="status"
        className="w-full max-w-md border-emerald-600/30 shadow-lg dark:border-emerald-400/30"
      >
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium">{t('update.title')}</p>
            <p className="truncate text-xs text-muted-foreground">
              {status.notes ?? t('update.notesFallback', { version: status.version })}
            </p>
          </div>
          <Button disabled={installing} onClick={() => void installUpdate()}>
            {installing ? t('update.installing') : t('update.restartToUpdate')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
