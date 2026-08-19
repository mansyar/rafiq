import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { PagePlaceholder } from '@/pages/placeholder';
import { Settings } from '@/pages/settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PagePlaceholder page="today" />} />
          <Route path="quran" element={<PagePlaceholder page="quran" />} />
          <Route path="log" element={<PagePlaceholder page="log" />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
