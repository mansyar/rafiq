// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '@/i18n';
import { QueryError } from './query-error';

beforeAll(async () => {
  await initI18n();
});

describe('QueryError', () => {
  it('renders the localized message and a Retry button with role="alert"', () => {
    render(<QueryError message="Could not load prayer times" onRetry={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load prayer times');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('disables the Retry button while refetching', () => {
    render(<QueryError message="boom" onRetry={() => {}} retrying />);
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
  });

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    render(<QueryError message="boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('is a real button reachable by keyboard', () => {
    render(<QueryError message="boom" onRetry={() => {}} />);
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    expect(retry).toHaveFocus();
  });
});
