import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { resetModalLayerStackForTests } from '@/components/ui/modalLayer';
import { useModalLayer } from '@/components/ui/useModalLayer';

function LayerProbe({ label }: { label: string }) {
  const { contentZ, attach } = useModalLayer();
  return (
    <div ref={attach} data-testid={label} data-z={contentZ}>
      {label}
    </div>
  );
}

describe('useModalLayer', () => {
  it('takes a layer only while the surface node is mounted', () => {
    resetModalLayerStackForTests();
    const first = render(<LayerProbe label="first" />);
    expect(screen.getByTestId('first').getAttribute('data-z')).toBe('101');
    first.unmount();

    // Nothing is open, so the stack depth reset and the next surface starts at base.
    render(<LayerProbe label="second" />);
    expect(screen.getByTestId('second').getAttribute('data-z')).toBe('101');
  });

  it('climbs for nested surfaces and resets once all close', () => {
    resetModalLayerStackForTests();
    const outer = render(<LayerProbe label="outer" />);
    const inner = render(<LayerProbe label="inner" />);
    expect(screen.getByTestId('outer').getAttribute('data-z')).toBe('101');
    expect(screen.getByTestId('inner').getAttribute('data-z')).toBe('111');

    inner.unmount();
    outer.unmount();

    render(<LayerProbe label="next" />);
    expect(screen.getByTestId('next').getAttribute('data-z')).toBe('101');
  });
});
