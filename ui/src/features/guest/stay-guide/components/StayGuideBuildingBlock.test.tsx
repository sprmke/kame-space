import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StayGuideBuildingBlock } from '@/features/guest/stay-guide/components/StayGuideBuildingBlock';

const INFO = {
  requirements: 'Register at the lobby on arrival.',
  guides: [{ id: 'wifi', title: 'Wi-Fi', content: 'Network: AzureGuest' }],
  importantInfo: 'Water is shut off Tuesdays, 9-11 AM.',
  rules: [
    { id: 'no-smoking', text: 'No smoking in the unit.', type: 'prohibited' as const },
    { id: 'pool-hours', text: 'Pool closes at 10 PM.', type: 'info' as const },
  ],
  poolFee: 200,
  poolSchedule: '7 AM to 7 PM',
  amenities: ['Gym'],
};

describe('StayGuideBuildingBlock', () => {
  it('renders the building rules, info and facilities', () => {
    render(<StayGuideBuildingBlock info={INFO} />);

    expect(screen.getByRole('heading', { name: 'The building' })).toBeTruthy();
    expect(screen.getByText('No smoking in the unit.')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText('Wi-Fi')).toBeTruthy();
    expect(screen.getByText('Pool ₱200')).toBeTruthy();
    expect(screen.getByText('Gym')).toBeTruthy();
  });

  it('omits the sections a building did not fill in', () => {
    render(
      <StayGuideBuildingBlock
        info={{
          ...INFO,
          requirements: '',
          guides: [],
          importantInfo: '',
          amenities: [],
          poolFee: null,
          poolSchedule: '',
        }}
      />
    );

    expect(screen.queryByText('Requirements')).toBeNull();
    expect(screen.queryByText('Guides')).toBeNull();
    expect(screen.queryByText('Facilities')).toBeNull();
    // The rules it does have are still shown.
    expect(screen.getByText('No smoking in the unit.')).toBeTruthy();
  });
});
