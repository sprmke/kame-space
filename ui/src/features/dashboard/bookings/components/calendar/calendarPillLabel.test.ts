import { describe, expect, it } from 'vitest';

import {
  formatOccupancyPillAmountK,
  guestFirstName,
  guestInitials,
  guestSingleInitial,
  occupancyPillCharBudget,
  occupancyPillDisplayLabel,
  occupancyPillShowStatusDot,
  resolveOccupancyPillLabelMode,
  resolveOccupancyPricePillPresentation,
} from '@/features/dashboard/bookings/components/calendar/calendarPillLabel';

describe('occupancyPillCharBudget', () => {
  it('gives phone one- and two-day cells room for two initials', () => {
    expect(occupancyPillCharBudget({ isBelowLg: true, spanCols: 1 })).toBe(2);
    expect(occupancyPillCharBudget({ isBelowLg: true, spanCols: 2 })).toBe(2);
  });

  it('gives desktop cells room for peso + k on short spans', () => {
    expect(occupancyPillCharBudget({ isBelowLg: false, spanCols: 1 })).toBe(3);
    expect(occupancyPillCharBudget({ isBelowLg: false, spanCols: 2 })).toBe(5);
  });
});

describe('resolveOccupancyPillLabelMode', () => {
  it('uses two-letter initials on short phone spans', () => {
    expect(
      resolveOccupancyPillLabelMode({
        isBelowLg: true,
        spanCols: 1,
        label: 'Katherine Reyes',
        kind: 'name',
      })
    ).toBe('initials');
    expect(
      resolveOccupancyPillLabelMode({
        isBelowLg: true,
        spanCols: 2,
        label: 'Katherine Reyes',
        kind: 'name',
      })
    ).toBe('initials');
  });

  it('prefers first name when the full name is too long', () => {
    // Desktop 3-col budget is 8: "Sofia Reyes" (11) → "Sofia" (5).
    expect(
      resolveOccupancyPillLabelMode({
        isBelowLg: false,
        spanCols: 3,
        label: 'Sofia Reyes',
        kind: 'name',
      })
    ).toBe('first');
  });

  it('uses the full name when it fits', () => {
    expect(
      resolveOccupancyPillLabelMode({
        isBelowLg: false,
        spanCols: 5,
        label: 'Neil Cruz',
        kind: 'name',
      })
    ).toBe('full');
  });

  it('falls back to initials when a long single token exceeds the budget', () => {
    expect(
      resolveOccupancyPillLabelMode({
        isBelowLg: false,
        spanCols: 2,
        label: 'Katherine',
        kind: 'name',
      })
    ).toBe('initials');
  });
});

describe('guest name helpers', () => {
  it('guestFirstName takes the first token', () => {
    expect(guestFirstName('Juan Dela Cruz')).toBe('Juan');
  });

  it('guestInitials takes two letters from a single token', () => {
    expect(guestInitials('Katherine')).toBe('KA');
  });

  it('guestInitials takes first letters of two tokens', () => {
    expect(guestInitials('Juan Dela')).toBe('JD');
  });

  it('guestSingleInitial takes one letter', () => {
    expect(guestSingleInitial('Katherine Reyes')).toBe('K');
  });
});

describe('occupancyPillDisplayLabel', () => {
  it('maps each mode to the right text', () => {
    expect(occupancyPillDisplayLabel('Katherine Reyes', 'full')).toBe('Katherine Reyes');
    expect(occupancyPillDisplayLabel('Katherine Reyes', 'first')).toBe('Katherine');
    expect(occupancyPillDisplayLabel('Katherine Reyes', 'initials')).toBe('KR');
    expect(occupancyPillDisplayLabel('Katherine Reyes', 'single')).toBe('K');
  });
});

describe('formatOccupancyPillAmountK', () => {
  it('shortens thousands', () => {
    expect(formatOccupancyPillAmountK(7000)).toBe('7k');
    expect(formatOccupancyPillAmountK(10500)).toBe('10.5k');
    expect(formatOccupancyPillAmountK(300)).toBe('300');
  });
});

describe('resolveOccupancyPricePillPresentation', () => {
  it('hides price only on phone one-day cells', () => {
    expect(
      resolveOccupancyPricePillPresentation({
        isBelowLg: true,
        spanCols: 1,
        amount: 7000,
      })
    ).toEqual({ label: null, showStatusDot: false });
  });

  it('uses peso + k with a dot on desktop short spans (incl. dashboard mini)', () => {
    expect(
      resolveOccupancyPricePillPresentation({
        isBelowLg: false,
        spanCols: 1,
        amount: 7000,
      })
    ).toEqual({ label: '₱7k', showStatusDot: true });
    expect(
      resolveOccupancyPricePillPresentation({
        isBelowLg: false,
        spanCols: 2,
        amount: 7000,
      })
    ).toEqual({ label: '₱7k', showStatusDot: true });
  });

  it('uses plain k without a dot on short phone spans', () => {
    expect(
      resolveOccupancyPricePillPresentation({
        isBelowLg: true,
        spanCols: 2,
        amount: 7000,
      })
    ).toEqual({ label: '7k', showStatusDot: false });
  });

  it('uses peso + k on wider phone spans', () => {
    expect(
      resolveOccupancyPricePillPresentation({
        isBelowLg: true,
        spanCols: 3,
        amount: 7000,
      })
    ).toEqual({ label: '₱7k', showStatusDot: true });
  });

  it('uses the full compact peso amount on wide bars', () => {
    const result = resolveOccupancyPricePillPresentation({
      isBelowLg: false,
      spanCols: 5,
      amount: 7000,
    });
    expect(result.showStatusDot).toBe(true);
    expect(result.label).toMatch(/7,000/);
    expect(result.label).toMatch(/₱|PHP/);
  });
});

describe('occupancyPillShowStatusDot', () => {
  it('keeps the dot for first/full names', () => {
    expect(
      occupancyPillShowStatusDot({
        isBelowLg: true,
        spanCols: 3,
        labelMode: 'first',
      })
    ).toBe(true);
  });

  it('drops the dot when initials fill a tight phone cell', () => {
    expect(
      occupancyPillShowStatusDot({
        isBelowLg: true,
        spanCols: 1,
        labelMode: 'initials',
      })
    ).toBe(false);
    expect(
      occupancyPillShowStatusDot({
        isBelowLg: true,
        spanCols: 2,
        labelMode: 'initials',
      })
    ).toBe(false);
  });

  it('keeps the dot on wider phone spans even with initials', () => {
    expect(
      occupancyPillShowStatusDot({
        isBelowLg: true,
        spanCols: 3,
        labelMode: 'initials',
      })
    ).toBe(true);
  });

  it('keeps the dot on desktop even for short initials spans', () => {
    expect(
      occupancyPillShowStatusDot({
        isBelowLg: false,
        spanCols: 2,
        labelMode: 'initials',
      })
    ).toBe(true);
  });
});
