import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstagramSongCard } from '@/features/dashboard/marketing/components/video-editor/v2/InstagramSongCard';
import type { InstagramSong } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

const fetchInstagramSong = vi.fn();
const toastMessage = vi.fn();

vi.mock('@/features/dashboard/marketing/hooks/useMarketingMusic', () => ({
  fetchInstagramSong: (...args: unknown[]) => fetchInstagramSong(...args),
}));
vi.mock('sonner', () => ({ toast: { message: (...a: unknown[]) => toastMessage(...a) } }));

const audioInstances: Array<{ src: string }> = [];
class FakeAudio {
  src: string;
  preload = '';
  constructor(src: string) {
    this.src = src;
    audioInstances.push(this);
  }
  addEventListener() {}
  removeAttribute() {}
  load() {}
  pause() {}
  play() {
    return Promise.resolve();
  }
}

const SONG: InstagramSong = {
  audioId: '1234',
  title: 'Golden Hour',
  artist: 'JVKE',
  imageUrl: null,
  durationSec: 209,
  volume: 70,
};

beforeEach(() => {
  audioInstances.length = 0;
  fetchInstagramSong.mockReset();
  toastMessage.mockReset();
  vi.stubGlobal('Audio', FakeAudio);
});

describe('InstagramSongCard', () => {
  it('shows the song, its artist and length', () => {
    render(<InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} />);
    expect(screen.getByText('Golden Hour')).toBeTruthy();
    expect(screen.getByText('Instagram · JVKE · 3:29')).toBeTruthy();
  });

  it('asks for a fresh preview link each time it plays', async () => {
    fetchInstagramSong.mockResolvedValue({ streamUrl: 'https://cdn/fresh.mp3' });
    render(<InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play Golden Hour' }));

    await waitFor(() =>
      expect(audioInstances.map((a) => a.src)).toEqual(['https://cdn/fresh.mp3'])
    );
    expect(fetchInstagramSong).toHaveBeenCalledWith('p', '1234');
  });

  it('tells the host when Instagram has no preview for the song', async () => {
    fetchInstagramSong.mockResolvedValue({ streamUrl: null });
    render(<InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Golden Hour' }));
    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith('Instagram has no preview for this song')
    );
    expect(audioInstances).toHaveLength(0);
  });

  it('tells the host when the preview cannot be loaded', async () => {
    fetchInstagramSong.mockRejectedValue(new Error('403'));
    render(<InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Golden Hour' }));
    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith('Could not load the preview'));
  });

  it('removes the song', () => {
    const onRemove = vi.fn();
    render(<InstagramSongCard song={SONG} propertyId="p" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Instagram song' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('hides Remove when the editor is read only', () => {
    render(<InstagramSongCard song={SONG} propertyId="p" readOnly onRemove={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Remove Instagram song' })).toBeNull();
  });

  it('shows the volume slider and the note only in the inspector', () => {
    const { rerender } = render(
      <InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} />
    );
    expect(screen.queryByText(/not in a downloaded video/)).toBeNull();

    rerender(
      <InstagramSongCard song={SONG} propertyId="p" onRemove={vi.fn()} onVolumeChange={vi.fn()} />
    );
    expect(screen.getByText('Song volume')).toBeTruthy();
    expect(
      screen.getByText(
        'Instagram adds this song when you post as a Reel. It is not in a downloaded video.'
      )
    ).toBeTruthy();
  });
});
