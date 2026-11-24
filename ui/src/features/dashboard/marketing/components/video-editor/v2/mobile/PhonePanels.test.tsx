import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MarketingAutoSaveStatus } from '@/features/dashboard/marketing/components/shared/MarketingAutoSaveStatus';
import { ChoiceChips } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/ChoiceChips';
import { PanelSlider } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/PanelSlider';

describe('ChoiceChips', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];

  it('marks the chosen option and reports a new choice', () => {
    const onChange = vi.fn();
    render(<ChoiceChips label="Pick" value="a" options={options} onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Pick' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Alpha' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Beta' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('wraps instead of hiding choices off to the side', () => {
    render(<ChoiceChips label="Pick" value="a" options={options} onChange={() => undefined} />);
    const row = screen.getByRole('radio', { name: 'Alpha' }).parentElement!;
    expect(row.className).toContain('flex-wrap');
    expect(row.className).not.toContain('overflow-x-auto');
  });
});

describe('PanelSlider', () => {
  it('shows the label and value and reports changes as numbers', () => {
    const onChange = vi.fn();
    render(<PanelSlider label="Volume" unit="%" value={40} onChange={onChange} />);
    const slider = screen.getByLabelText('Volume') as HTMLInputElement;
    expect(slider.type).toBe('range');
    expect(screen.getByText('40%')).toBeTruthy();
    fireEvent.change(slider, { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledWith(65);
  });

  it('has no number box to type into', () => {
    render(<PanelSlider label="Volume" value={10} onChange={() => undefined} />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('shows one decimal for fractional steps', () => {
    render(
      <PanelSlider
        label="Seconds"
        unit="s"
        step={0.1}
        min={0}
        max={5}
        value={2.5}
        onChange={() => undefined}
      />
    );
    expect(screen.getByText('2.5s')).toBeTruthy();
  });
});

describe('MarketingAutoSaveStatus', () => {
  it('keeps the words for screen readers in compact mode', () => {
    render(<MarketingAutoSaveStatus status="saved" compact />);
    expect(screen.getByRole('status').textContent).toContain('Saved');
  });

  it('shows the words by default and nothing when idle', () => {
    const { rerender, container } = render(<MarketingAutoSaveStatus status="pending" />);
    expect(screen.getByText('Unsaved')).toBeTruthy();
    rerender(<MarketingAutoSaveStatus status="idle" compact />);
    expect(container.textContent).toBe('');
  });

  it('says when saving failed', () => {
    render(<MarketingAutoSaveStatus status="error" compact errorMessage="Offline" />);
    expect(screen.getByRole('status').textContent).toContain('Save failed');
  });
});
