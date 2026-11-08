import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useOpenDraftDirty } from '@/features/dashboard/lib/useOpenDraftDirty';

type Props = { open: boolean; draft: unknown };

function renderDirty(initial: Props) {
  return renderHook(({ open, draft }: Props) => useOpenDraftDirty(open, draft), {
    initialProps: initial,
  });
}

describe('useOpenDraftDirty', () => {
  it('is clean the moment the modal opens', () => {
    const { result } = renderDirty({ open: true, draft: { name: 'Monaco 2604' } });

    expect(result.current).toBe(false);
  });

  it('is clean while the modal is closed, whatever the draft holds', () => {
    const { result } = renderDirty({ open: false, draft: { name: 'anything' } });

    expect(result.current).toBe(false);
  });

  it('turns dirty on the first real edit', () => {
    const { result, rerender } = renderDirty({ open: true, draft: { name: 'Monaco 2604' } });

    rerender({ open: true, draft: { name: 'Monaco 2604 Tower 2' } });

    expect(result.current).toBe(true);
  });

  it('notices a nested change, not just a top-level key swap', () => {
    const { result, rerender } = renderDirty({
      open: true,
      draft: { pricing: { base: 4500 } },
    });

    rerender({ open: true, draft: { pricing: { base: 5000 } } });

    expect(result.current).toBe(true);
  });

  it('re-baselines on close, so reopening starts clean', () => {
    const { result, rerender } = renderDirty({ open: true, draft: { name: 'a' } });
    rerender({ open: true, draft: { name: 'b' } });
    expect(result.current).toBe(true);

    rerender({ open: false, draft: { name: 'b' } });
    expect(result.current).toBe(false);

    rerender({ open: true, draft: { name: 'b' } });
    expect(result.current).toBe(false);
  });

  it('is dirty again after a second edit on the re-baselined draft', () => {
    const { result, rerender } = renderDirty({ open: true, draft: { name: 'a' } });
    rerender({ open: false, draft: { name: 'a' } });
    rerender({ open: true, draft: { name: 'a' } });

    rerender({ open: true, draft: { name: 'a', note: 'late edit' } });

    expect(result.current).toBe(true);
  });

  it('treats a change back to the baseline as clean', () => {
    const { result, rerender } = renderDirty({ open: true, draft: { name: 'a' } });
    rerender({ open: true, draft: { name: 'b' } });
    rerender({ open: true, draft: { name: 'a' } });

    expect(result.current).toBe(false);
  });
});
