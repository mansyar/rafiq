import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdhanPlayer } from '@/components/adhan-player';
import { Layout } from '@/components/layout';
import { PagePlaceholder } from '@/pages/placeholder';
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
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="quran" element={<QuranList />} />
            <Route path="quran/:id" element={<QuranReader />} />
            <Route path="log" element={<PagePlaceholder page="log" />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
