import { describe, expect, it } from 'vitest';

import { formatTrackDuration, musicTrackKey } from './musicTypes';

describe('formatTrackDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatTrackDuration(151)).toBe('2:31');
    expect(formatTrackDuration(60)).toBe('1:00');
    expect(formatTrackDuration(5.4)).toBe('0:05');
  });

  it('is empty for zero, negative and invalid values', () => {
    expect(formatTrackDuration(0)).toBe('');
    expect(formatTrackDuration(-3)).toBe('');
    expect(formatTrackDuration(Number.NaN)).toBe('');
  });
});

describe('musicTrackKey', () => {
  it('keeps the same id from two sources apart', () => {
    expect(musicTrackKey({ source: 'jamendo', id: '1' })).not.toBe(
      musicTrackKey({ source: 'audius', id: '1' })
    );
  });
});
