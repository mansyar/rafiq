import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PagePlaceholderProps {
  page: 'today' | 'quran' | 'log' | 'settings';
}

export default function PagePlaceholder({ page }: PagePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby={`page-${page}`} className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle id={`page-${page}`} className="font-heading text-2xl">
            {t(`page.${page}.title`)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t(`page.${page}.subtitle`)}</p>
        </CardHeader>
        <CardContent>
          <p>{t(`page.${page}.body`)}</p>
        </CardContent>
      </Card>
    </section>
  );
}
