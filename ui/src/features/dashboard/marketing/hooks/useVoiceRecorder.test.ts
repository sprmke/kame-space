import { describe, expect, it } from 'vitest';

import {
  extensionForRecorderMime,
  pickRecorderMime,
} from '@/features/dashboard/marketing/hooks/useVoiceRecorder';

describe('pickRecorderMime', () => {
  it('prefers AAC in MP4, then WebM, and gives up when nothing is supported', () => {
    expect(pickRecorderMime(() => true)).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(pickRecorderMime((mime) => mime.startsWith('audio/webm'))).toBe(
      'audio/webm;codecs=opus'
    );
    expect(pickRecorderMime((mime) => mime === 'audio/webm')).toBe('audio/webm');
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe('extensionForRecorderMime', () => {
  it('names the file by what it is', () => {
    expect(extensionForRecorderMime('audio/mp4;codecs=mp4a.40.2')).toBe('m4a');
    expect(extensionForRecorderMime('audio/webm;codecs=opus')).toBe('webm');
  });
});
