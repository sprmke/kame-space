import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MARKETING_STUDIO_TABS,
  MARKETING_STUDIO_TAB_LABELS,
  isMarketingEditorTab,
  isMarketingStudioTab,
  normalizeMarketingStudioTab,
  readLastMarketingTab,
  readLastMarketingTheme,
  resolveDefaultMarketingStudioTab,
  writeLastMarketingTab,
  writeLastMarketingTheme,
} from '@/features/dashboard/marketing/lib/theme/marketingStudioNav';

function fakeStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void store.set(key, value)),
    store,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('studio tabs', () => {
  it('labels every tab in display order', () => {
    expect(MARKETING_STUDIO_TABS[0]).toBe('plan');
    for (const tab of MARKETING_STUDIO_TABS) {
      expect(MARKETING_STUDIO_TAB_LABELS[tab].trim()).not.toBe('');
    }
  });

  it('narrows studio and editor tabs', () => {
    expect(isMarketingStudioTab('calendar')).toBe(true);
    expect(isMarketingStudioTab('settings')).toBe(false);

    expect(isMarketingEditorTab('design')).toBe(true);
    expect(isMarketingEditorTab('generate')).toBe(false);
    expect(isMarketingEditorTab('plan')).toBe(false);
    expect(isMarketingEditorTab(null)).toBe(false);
  });
});

describe('resolveDefaultMarketingStudioTab', () => {
  it('restores the last tab used on this property', () => {
    expect(resolveDefaultMarketingStudioTab({ lastTab: 'video', aiAvailable: true })).toBe('video');
  });

  it('opens the Plan when no tab is remembered', () => {
    expect(resolveDefaultMarketingStudioTab({ lastTab: null, aiAvailable: true })).toBe('plan');
    expect(resolveDefaultMarketingStudioTab({ lastTab: null, aiAvailable: false })).toBe('plan');
  });

  it('ignores an unknown stored tab', () => {
    expect(resolveDefaultMarketingStudioTab({ lastTab: 'nope', aiAvailable: false })).toBe('plan');
  });
});

describe('normalizeMarketingStudioTab', () => {
  it('returns a known tab or the fallback', () => {
    expect(normalizeMarketingStudioTab('video')).toBe('video');
    expect(normalizeMarketingStudioTab('nope')).toBe('generate');
    expect(normalizeMarketingStudioTab(undefined, 'calendar')).toBe('calendar');
  });
});

describe('per-property marketing storage', () => {
  it('round-trips the last tab and theme for a property', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });

    writeLastMarketingTab('property-1', 'calendar');
    writeLastMarketingTheme('property-1', 'starter:quiet-coast');

    expect(storage.store.get('marketing-last-tab:property-1')).toBe('calendar');
    expect(readLastMarketingTab('property-1')).toBe('calendar');
    expect(readLastMarketingTheme('property-1')).toBe('starter:quiet-coast');
  });

  it('does nothing without a property id', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });

    writeLastMarketingTab(null, 'video');
    writeLastMarketingTheme(null, 'starter:quiet-coast');

    expect(readLastMarketingTab(null)).toBeNull();
    expect(readLastMarketingTheme(null)).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores a stored tab that is no longer a tab', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({ 'marketing-last-tab:property-1': 'retired-tab' }),
    });

    expect(readLastMarketingTab('property-1')).toBeNull();
  });

  it('ignores an over-long stored theme key', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({ 'marketing-last-theme:property-1': 'x'.repeat(81) }),
    });

    expect(readLastMarketingTheme('property-1')).toBeNull();
  });

  it('survives blocked storage in both directions', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(() => writeLastMarketingTab('property-1', 'design')).not.toThrow();
    expect(readLastMarketingTab('property-1')).toBeNull();
    expect(readLastMarketingTheme('property-1')).toBeNull();
  });
});
