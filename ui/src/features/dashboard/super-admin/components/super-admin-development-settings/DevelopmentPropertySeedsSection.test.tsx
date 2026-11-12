import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DevelopmentPropertySeedsSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentPropertySeedsSection';

describe('DevelopmentPropertySeedsSection', () => {
  it('ticking an amenity adds its id', () => {
    const onChange = vi.fn();
    render(
      <DevelopmentPropertySeedsSection
        seeds={{ amenityIds: [], houseRuleIds: [] }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('WiFi'));

    expect(onChange).toHaveBeenCalledWith({ amenityIds: ['wifi'], houseRuleIds: [] });
  });

  it('unticking one removes only that id', () => {
    const onChange = vi.fn();
    render(
      <DevelopmentPropertySeedsSection
        seeds={{ amenityIds: ['wifi', 'pool'], houseRuleIds: [] }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('WiFi'));

    expect(onChange).toHaveBeenCalledWith({ amenityIds: ['pool'], houseRuleIds: [] });
  });

  it('ticks house rules separately from amenities', () => {
    const onChange = vi.fn();
    render(
      <DevelopmentPropertySeedsSection
        seeds={{ amenityIds: [], houseRuleIds: [] }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Quiet hours: 10 PM - 8 AM'));

    expect(onChange).toHaveBeenCalledWith({
      amenityIds: [],
      houseRuleIds: ['quiet_hours'],
    });
  });
});
