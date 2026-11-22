import { describe, expect, it } from 'vitest';

import {
  MODAL_DESCRIPTION_CLASS,
  MODAL_HEADER_CLASS,
  MODAL_HEADER_CLOSE_GUTTER_CLASS,
  MODAL_HEADER_STACK_CLASS,
} from '@/components/ui/modal-chrome';
import { cn } from '@/lib/utils';

/**
 * Guards the Booking Workflow regression: header `px-*` used to wipe the
 * absolute-close gutter via tailwind-merge, so Free/Paid sat under the X.
 */
describe('modal header close gutter', () => {
  it('keeps the close gutter when a caller passes px-* after a pr-* base', () => {
    const merged = cn('pr-11', 'px-4 sm:px-5', MODAL_HEADER_CLOSE_GUTTER_CLASS);
    expect(merged.split(/\s+/)).toEqual(
      expect.arrayContaining(MODAL_HEADER_CLOSE_GUTTER_CLASS.split(/\s+/))
    );
    expect(merged).not.toMatch(/(?:^|\s)pr-11(?:\s|$)/);
  });

  it('exposes pl + close gutter on MODAL_HEADER_CLASS (not px)', () => {
    expect(MODAL_HEADER_CLASS).toContain('pl-4');
    expect(MODAL_HEADER_CLASS).toContain('sm:pl-5');
    expect(MODAL_HEADER_CLASS).not.toMatch(/(?:^|\s)px-4(?:\s|$)/);
    expect(MODAL_HEADER_CLASS).toContain(MODAL_HEADER_CLOSE_GUTTER_CLASS);
  });
});

describe('modal header title stack', () => {
  it('kills caller space-y-* so title and description cannot double-gap', () => {
    const merged = cn('space-y-4 gap-2', MODAL_HEADER_STACK_CLASS);
    expect(merged).toContain('gap-1');
    expect(merged).toContain('space-y-0');
    expect(merged).not.toMatch(/(?:^|\s)space-y-4(?:\s|$)/);
    expect(merged).not.toMatch(/(?:^|\s)gap-2(?:\s|$)/);
  });

  it('keeps description at text-sm (never text-xs)', () => {
    expect(MODAL_DESCRIPTION_CLASS).toContain('text-sm');
    expect(MODAL_DESCRIPTION_CLASS).not.toContain('text-xs');
  });

  it('forces text-sm when a caller passes text-xs after the base', () => {
    const merged = cn('text-xs', MODAL_DESCRIPTION_CLASS);
    expect(merged).toContain('text-sm');
    expect(merged).not.toMatch(/(?:^|\s)text-xs(?:\s|$)/);
  });
});
