// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BillingSuccess } from '@/app/billing/success/billing-success';

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      successTitle: 'Pagamento confirmado',
      successDescription: 'Estamos liberando seu acesso.',
      successNote: 'Voce sera redirecionado em instantes.',
    };
    return messages[key] ?? key;
  },
}));

describe('BillingSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders success copy', () => {
    render(<BillingSuccess />);

    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument();
    expect(screen.getByText('Estamos liberando seu acesso.')).toBeInTheDocument();
    expect(screen.getByText('Voce sera redirecionado em instantes.')).toBeInTheDocument();
  });

  it('redirects to dashboard after delay', async () => {
    render(<BillingSuccess />);

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    expect(refreshMock).toHaveBeenCalled();
  });
});
