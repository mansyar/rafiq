// Shared Vitest setup: registers jest-dom matchers (toBeInTheDocument,
// toBeDisabled, ...) and unmounts rendered trees between tests. Loaded via
// `setupFiles` in vite.config.ts. Environment-agnostic — harmless for
// node-env lib tests.

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
