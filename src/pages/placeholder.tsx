import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_LOCALE, type Locale, stringsFor } from '@/lib/locale';

interface PagePlaceholderProps {
  page: 'today' | 'quran' | 'log' | 'settings';
  locale?: Locale;
}

export default function PagePlaceholder({ page, locale = DEFAULT_LOCALE }: PagePlaceholderProps) {
  const strings = stringsFor(locale).page[page];

  return (
    <section aria-labelledby={`page-${page}`} className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle id={`page-${page}`} className="font-heading text-2xl">
            {strings.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{strings.subtitle}</p>
        </CardHeader>
        <CardContent>
          <p>{strings.body}</p>
        </CardContent>
      </Card>
    </section>
  );
}
