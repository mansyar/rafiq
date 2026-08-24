// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { useDailyContent } from '@/lib/daily';
import { DailyReflectionCard } from './daily-reflection-card';

vi.mock('@/lib/daily', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daily')>();
  return { ...actual, useDailyContent: vi.fn() };
});

function renderCard() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <DailyReflectionCard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  await initI18n();
});

describe('DailyReflectionCard error state', () => {
  it('shows a friendly localized message, never the raw backend error', () => {
    vi.mocked(useDailyContent).mockReturnValue({
      isError: true,
      error: new Error('backend exploded'),
      isFetching: false,
      isLoading: false,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDailyContent>);
    renderCard();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load today's reflection.");
    expect(alert).not.toHaveTextContent('backend exploded');
  });

  it('offers a Retry button that refetches the daily content', () => {
    const refetch = vi.fn();
    vi.mocked(useDailyContent).mockReturnValue({
      isError: true,
      error: new Error('x'),
      isFetching: false,
      isLoading: false,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useDailyContent>);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
