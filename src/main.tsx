import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from '@/i18n';
import { loadPersistedLocale } from '@/lib/tauri';
import App from './App';
import './index.css';

async function bootstrap() {
  await initI18n(await loadPersistedLocale());
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
