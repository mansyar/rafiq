import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdhanPlayer } from '@/components/adhan-player';
import { Layout } from '@/components/layout';
import { OnboardingGuard } from '@/components/onboarding-guard';
import { PrayerPrompt } from '@/components/prayer-prompt';
import { UpdateBanner } from '@/components/update-banner';
import { CalendarPage } from '@/pages/calendar';
import { LogPage } from '@/pages/log';
import { Onboarding } from '@/pages/onboarding';
import { QuranList } from '@/pages/quran-list';
import { QuranReader } from '@/pages/quran-reader';
import { Settings } from '@/pages/settings';
import { Today } from '@/pages/today';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdhanPlayer />
      <UpdateBanner />
      <BrowserRouter>
        <PrayerPrompt />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<OnboardingGuard />}>
            <Route element={<Layout />}>
              <Route index element={<Today />} />
              <Route path="quran" element={<QuranList />} />
              <Route path="quran/:id" element={<QuranReader />} />
              <Route path="log" element={<LogPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
