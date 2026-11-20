import { describe, expect, it } from 'vitest';

import {
  compactTitleStyle,
  largeTitleStyle,
  titleCollapseFromRatio,
  TITLE_COLLAPSE_THRESHOLD,
} from '@/components/mobile/native/titleCollapse';

describe('titleCollapse', () => {
  it('maps full intersection to expanded', () => {
    expect(titleCollapseFromRatio(1)).toEqual({ progress: 0, compactVisible: false });
  });

  it('maps zero intersection to collapsed', () => {
    expect(titleCollapseFromRatio(0)).toEqual({ progress: 1, compactVisible: true });
  });

  it('shows compact after threshold', () => {
    const justUnder = titleCollapseFromRatio(1 - TITLE_COLLAPSE_THRESHOLD + 0.01);
    expect(justUnder.compactVisible).toBe(false);
    const justOver = titleCollapseFromRatio(1 - TITLE_COLLAPSE_THRESHOLD - 0.01);
    expect(justOver.compactVisible).toBe(true);
  });

  it('large title fades with a 4px rise', () => {
    const style = largeTitleStyle(0.5);
    expect(style.opacity).toBe(0.5);
    expect(style.transform).toContain('-2.00px');
  });

  it('compact title fades in after threshold', () => {
    const hidden = compactTitleStyle(0);
    expect(hidden.opacity).toBe(0);
    const shown = compactTitleStyle(1);
    expect(shown.opacity).toBe(1);
  });
});
