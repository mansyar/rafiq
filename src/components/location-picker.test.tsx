// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '@/i18n';

vi.mock('@/lib/prayer', () => ({
  getResolvedLocation: vi.fn(),
  searchCities: vi.fn(),
  setLocation: vi.fn(),
}));

import { LocationPicker } from '@/components/location-picker';
import { getResolvedLocation, searchCities, setLocation } from '@/lib/prayer';

const JAKARTA = {
  id: 'jakarta',
  name: 'Jakarta',
  country: 'Indonesia',
  country_code: 'ID',
  latitude: -6.2088,
  longitude: 106.8456,
  timezone: 'Asia/Jakarta',
};

function renderPicker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocationPicker idPrefix="test" />
    </QueryClientProvider>,
  );
}

describe('LocationPicker double-save guard', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResolvedLocation).mockResolvedValue(null);
    vi.mocked(searchCities).mockResolvedValue([]);
  });

  it('disables city result buttons while the mutation is pending', async () => {
    vi.mocked(searchCities).mockResolvedValue([JAKARTA]);
    let resolveSave: (value: void | PromiseLike<void>) => void = () => {};
    vi.mocked(setLocation).mockReturnValue(
      new Promise((res) => {
        resolveSave = res;
      }) as ReturnType<typeof setLocation>,
    );

    renderPicker();
    const input = screen.getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'jaka' } });

    const cityBtn = await screen.findByRole('button', { name: /jakarta/i });
    fireEvent.click(cityBtn);

    await waitFor(() => expect(cityBtn).toBeDisabled());
    expect(setLocation).toHaveBeenCalledTimes(1);

    // A second click while disabled must not double-save.
    fireEvent.click(cityBtn);
    expect(setLocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave(undefined);
    });
  });

  it('keeps the manual save button disabled while the mutation is pending', async () => {
    let resolveSave: (value: void | PromiseLike<void>) => void = () => {};
    vi.mocked(setLocation).mockReturnValue(
      new Promise((res) => {
        resolveSave = res;
      }) as ReturnType<typeof setLocation>,
    );

    renderPicker();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: '-6.2088' } });
    fireEvent.change(inputs[2], { target: { value: '106.8456' } });

    const saveBtn = screen.getByRole('button', { name: /save location/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(saveBtn).toBeDisabled());
    expect(setLocation).toHaveBeenCalledTimes(1);

    fireEvent.click(saveBtn);
    expect(setLocation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave(undefined);
    });
  });

  it('localizes the invalid-coordinates message instead of hardcoding English', async () => {
    await initI18n('id');
    renderPicker();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'abc' } });

    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Masukkan angka yang valid');
  });
});
