import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = { warning: vi.fn(), success: vi.fn() };
const isAiVerdictBlockedError = vi.fn();

vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/dashboard/bookings/hooks/useTransitionBooking', () => ({
  isAiVerdictBlockedError,
}));

const { offerAiVerdictOverride } = await import(
  '@/features/dashboard/bookings/lib/aiVerdictOverride'
);

describe('offerAiVerdictOverride', () => {
  beforeEach(() => {
    toast.warning.mockReset();
    isAiVerdictBlockedError.mockReset();
  });

  it('ignores an error that is not an AI verdict block', () => {
    isAiVerdictBlockedError.mockReturnValue(false);
    const proceed = vi.fn();

    expect(offerAiVerdictOverride(new Error('other'), proceed)).toBe(false);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('offers a Proceed anyway action that retries the transition', () => {
    isAiVerdictBlockedError.mockReturnValue(true);
    const proceed = vi.fn();

    expect(offerAiVerdictOverride({ message: 'Receipt looks invalid' }, proceed)).toBe(true);

    expect(toast.warning).toHaveBeenCalledWith(
      'Receipt looks invalid',
      expect.objectContaining({ duration: 15_000 })
    );

    const options = toast.warning.mock.calls[0]?.[1] as {
      action: { label: string; onClick: () => void };
    };
    expect(options.action.label).toBe('Proceed anyway');

    options.action.onClick();
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});
