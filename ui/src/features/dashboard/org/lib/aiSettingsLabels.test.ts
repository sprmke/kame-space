import { describe, expect, it } from 'vitest';

import * as labels from '@/features/dashboard/org/lib/aiSettingsLabels';

describe('AI settings labels', () => {
  it('anchors the settings card to the ai section id', () => {
    expect(labels.AI_SETTINGS_SECTION_ID).toBe('ai');
  });

  it('uses the same wording for the nav item and the card title', () => {
    expect(labels.AI_SETTINGS_NAV_LABEL).toBe(labels.AI_SETTINGS_CARD_TITLE);
  });

  it('labels every group and toggle', () => {
    const copy = Object.entries(labels).filter(([name]) => name.endsWith('_TITLE') || name.endsWith('_LABEL'));

    expect(copy.length).toBeGreaterThan(5);
    for (const [, value] of copy) {
      expect(String(value).trim()).not.toBe('');
      expect(String(value)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
