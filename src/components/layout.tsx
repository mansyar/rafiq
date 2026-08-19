import { BookOpenText, NotebookPen, Settings, Sun } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { DEFAULT_LOCALE, type Locale, stringsFor } from '@/lib/locale';

interface LayoutProps {
  locale?: Locale;
}

const NAV_ITEMS = [
  { to: '/', icon: Sun, key: 'today', end: true },
  { to: '/quran', icon: BookOpenText, key: 'quran', end: false },
  { to: '/log', icon: NotebookPen, key: 'log', end: false },
  { to: '/settings', icon: Settings, key: 'settings', end: false },
] as const;

export default function Layout({ locale = DEFAULT_LOCALE }: LayoutProps) {
  const strings = stringsFor(locale);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        aria-label="Primary"
        className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <Sun aria-hidden="true" className="size-6 text-gold-500" strokeWidth={2} />
          <div>
            <p className="font-heading text-lg font-semibold leading-tight">{strings.brand}</p>
            <p className="text-xs text-muted-foreground">{strings.tagline}</p>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="mt-2 flex-1 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, icon: Icon, key, end }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  end={end}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span>{strings.nav[key]}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <p className="px-5 py-4 text-xs text-muted-foreground">Rafiq v0.1.0</p>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
