import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PropertyRules } from '@/features/guest/marketing/properties/components/property-detail/PropertyRules';

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }: { children?: unknown }) => (
      <section {...(props as Record<string, unknown>)}>{children as never}</section>
    ),
  },
}));

const CANCELLATION = {
  presetId: 'flexible' as const,
  tone: 'positive' as const,
  showListingHighlight: true,
  title: 'Flexible',
  description: 'Full refund up to 48 hours before check-in.',
  shortLabel: 'Flexible',
  timeline: [],
  fallbackRefundPercent: 100,
  needsReview: false,
  unset: false,
  capturedFrom: null,
};

const BUILDING = {
  requirements: 'Register at the lobby.',
  guides: [{ id: 'wifi', title: 'Wi-Fi', content: 'Network: AzureGuest' }],
  importantInfo: 'Water is shut off every Tuesday morning.',
  rules: [
    { id: 'no-smoking', text: 'No smoking in the unit.', type: 'prohibited' as const },
    { id: 'pool-hours', text: 'Pool is open until 10 PM.', type: 'info' as const },
  ],
  poolFee: 200,
  poolSchedule: '7 AM to 7 PM',
  amenities: ['Gym'],
};

function renderRules(buildingInfo: typeof BUILDING | null) {
  render(
    <PropertyRules
      houseRules={[]}
      cancellationPolicy={CANCELLATION}
      buildingInfo={buildingInfo}
    />
  );
}

describe('PropertyRules building block', () => {
  it('renders the building rules, info and facilities when the API sends them', () => {
    renderRules(BUILDING);

    expect(screen.getByText('The building')).toBeTruthy();
    expect(screen.getByText('No smoking in the unit.')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText('Wi-Fi')).toBeTruthy();
    expect(screen.getByText('Pool ₱200')).toBeTruthy();
    expect(screen.getByText('Gym')).toBeTruthy();
  });

  it('renders no building block when the residence hides it', () => {
    renderRules(null);
    expect(screen.queryByText('The building')).toBeNull();
  });
});
