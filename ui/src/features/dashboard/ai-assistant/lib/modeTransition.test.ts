import { describe, expect, it, vi } from 'vitest';

import { runModeViewTransition } from '@/features/dashboard/ai-assistant/lib/modeTransition';

type FakeDocument = {
  documentElement: { dataset: Record<string, string | undefined> };
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function stubDocument(overrides: Partial<FakeDocument> = {}): FakeDocument {
  const doc: FakeDocument = {
    documentElement: { dataset: {} },
    ...overrides,
  };
  vi.stubGlobal('document', doc);
  return doc;
}

describe('runModeViewTransition', () => {
  it('reports unsupported when there is no document at all', () => {
    expect(runModeViewTransition(() => {}, { reducedMotion: false })).toBe(false);
  });

  it('reports unsupported when the browser has no View Transitions', () => {
    stubDocument();
    const update = vi.fn();

    expect(runModeViewTransition(update, { reducedMotion: false })).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('runs the update inside the transition and reports support', () => {
    const update = vi.fn();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { finished: Promise.resolve() };
    });
    const doc = stubDocument({ startViewTransition });

    expect(runModeViewTransition(update, { reducedMotion: false })).toBe(true);
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(doc.documentElement.dataset.modeTransition).toBe('full');
  });

  it('marks a reduced-motion switch', () => {
    const doc = stubDocument({
      startViewTransition: (callback) => {
        callback();
        return { finished: Promise.resolve() };
      },
    });

    runModeViewTransition(() => {}, { reducedMotion: true });

    expect(doc.documentElement.dataset.modeTransition).toBe('reduced');
  });

  it('falls back when the browser throws, and leaves no marker behind', () => {
    const doc = stubDocument({
      startViewTransition: () => {
        throw new Error('not available');
      },
    });
    const update = vi.fn();

    expect(runModeViewTransition(update, { reducedMotion: false })).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(doc.documentElement.dataset.modeTransition).toBeUndefined();
  });
});
