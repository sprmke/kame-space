import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VideoToolStrip } from '@/features/dashboard/marketing/components/video-editor/v2/mobile/VideoToolStrip';
import {
  DEFAULT_PHONE_TOOL_OPTIONS,
  type PhoneToolAction,
  type SelectionKind,
} from '@/features/dashboard/marketing/lib/video/v2/phoneTools';

function setup(
  selection: SelectionKind = 'none',
  extra: Partial<Parameters<typeof VideoToolStrip>[0]> = {}
) {
  const onAction = vi.fn<(action: PhoneToolAction) => void>();
  const onDone = vi.fn();
  const view = render(
    <VideoToolStrip
      options={{ ...DEFAULT_PHONE_TOOL_OPTIONS, soundTools: true, voice: true, captions: true }}
      selection={selection}
      onAction={onAction}
      onDone={onDone}
      {...extra}
    />
  );
  return { ...view, onAction, onDone };
}

describe('VideoToolStrip', () => {
  it('starts on the root tools', () => {
    setup();
    const strip = screen.getByRole('toolbar', { name: 'Editor tools' });
    for (const name of ['Audio', 'Text', 'Captions', 'Media', 'Templates', 'Size', 'Background']) {
      expect(within(strip).getByRole('button', { name })).toBeTruthy();
    }
  });

  it('opens a second row and goes back with the arrow', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    const row = screen.getByRole('toolbar', { name: 'Tool options' });
    expect(within(row).getByRole('button', { name: 'Record voice' })).toBeTruthy();
    expect(within(row).queryByRole('button', { name: 'Templates' })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('toolbar', { name: 'Editor tools' })).toBeTruthy();
  });

  it('runs a tool and returns to the first row', () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }));
    expect(onAction).toHaveBeenCalledWith('audio-record');
    expect(screen.getByRole('toolbar', { name: 'Editor tools' })).toBeTruthy();
  });

  it('runs a root tool without opening a row', () => {
    const { onAction } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(onAction).toHaveBeenCalledWith('open-templates');
  });

  it('shows the tools for the selected clip and clears with Done', () => {
    const { onDone } = setup('video');
    const row = screen.getByRole('toolbar', { name: 'Clip tools' });
    expect(within(row).getByRole('button', { name: 'Trim' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Speed' })).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('leaves a second row open when something gets selected', () => {
    const { rerender, onAction, onDone } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    rerender(
      <VideoToolStrip
        options={DEFAULT_PHONE_TOOL_OPTIONS}
        selection="photo"
        onAction={onAction}
        onDone={onDone}
      />
    );
    expect(screen.getByRole('toolbar', { name: 'Clip tools' })).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Tool options' })).toBeNull();
  });

  it('marks the open tool and greys out what cannot run', () => {
    setup('video', {
      activeAction: 'clip-speed',
      disabledActions: new Set<PhoneToolAction>(['clip-split']),
    });
    expect(screen.getByRole('button', { name: 'Speed' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: 'Split' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('lets a read-only role look but not change anything', () => {
    const { onAction } = setup('none', { readOnly: true });
    expect((screen.getByRole('button', { name: 'Templates' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const reviews = screen.getByRole('button', { name: 'Guest reviews' }) as HTMLButtonElement;
    expect(reviews.disabled).toBe(false);
    fireEvent.click(reviews);
    expect(onAction).toHaveBeenCalledWith('open-reviews');
  });
});
