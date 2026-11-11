import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DevelopmentGuestInfoSection } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentGuestInfoSection';
import { developmentProfileDraftFromDevelopment } from '@/features/dashboard/super-admin/lib/developmentSettingsForm';
import type { Development } from '@/features/dashboard/super-admin/types/development';

function draft(settings: Record<string, unknown> = {}) {
  return developmentProfileDraftFromDevelopment({
    id: 'dev-1',
    slug: 'test-residence',
    name: 'Test Residence',
    developerName: null,
    type: 'SUBDIVISION',
    status: 'ACTIVE',
    location: null,
    city: null,
    description: null,
    coverImageUrl: null,
    settings,
    stats: { propertyCount: 0, parkingCount: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Development);
}

describe('DevelopmentGuestInfoSection building rules', () => {
  it('lists the stored rules with their text', () => {
    const onChange = vi.fn();
    render(
      <DevelopmentGuestInfoSection
        draft={draft({ buildingRules: [{ id: 'r1', text: 'No pets on the pool deck.', type: 'info' }] })}
        onChange={onChange}
      />
    );

    expect((screen.getByLabelText('Rule 1') as HTMLInputElement).value).toBe(
      'No pets on the pool deck.'
    );
  });

  it('editing a rule reports the list with the new text', () => {
    const onChange = vi.fn();
    render(
      <DevelopmentGuestInfoSection
        draft={draft({ buildingRules: [{ id: 'r1', text: 'Old', type: 'info' }] })}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Rule 1'), { target: { value: 'New' } });

    expect(onChange).toHaveBeenCalledWith('buildingRules', [
      { id: 'r1', text: 'New', type: 'info' },
    ]);
  });

  it('hiding the stay guide reports both switches', () => {
    const onChange = vi.fn();
    render(<DevelopmentGuestInfoSection draft={draft()} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Show on the stay guide'));

    expect(onChange).toHaveBeenCalledWith('guestInfoVisibility', {
      stayGuide: false,
      propertyPage: true,
    });
  });

  it('adding a rule appends an empty one with a stable id', () => {
    const onChange = vi.fn();
    render(<DevelopmentGuestInfoSection draft={draft()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    const [, rules] = onChange.mock.calls[0] as [string, Array<{ id: string; text: string }>];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.text).toBe('');
    expect(rules[0]?.id).toMatch(/^rule-/);
  });
});
