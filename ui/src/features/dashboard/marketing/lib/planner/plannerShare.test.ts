import { describe, expect, it } from 'vitest';

import {
  extensionForMedia,
  resolveSharePlan,
  shareFileName,
  shareReminderText,
} from '@/features/dashboard/marketing/lib/planner/plannerShare';

describe('resolveSharePlan', () => {
  it('prefers sharing the file when the browser can', () => {
    expect(resolveSharePlan({ hasShare: true, canShareFiles: true, hasClipboard: true })).toBe(
      'share-files'
    );
  });

  it('shares text when files are not allowed', () => {
    expect(resolveSharePlan({ hasShare: true, canShareFiles: false, hasClipboard: true })).toBe(
      'share-text'
    );
  });

  it('falls back to copy only on desktop or unsupported browsers', () => {
    expect(resolveSharePlan({ hasShare: false, canShareFiles: false, hasClipboard: true })).toBe(
      'copy-only'
    );
    expect(resolveSharePlan({ hasShare: false, canShareFiles: false, hasClipboard: false })).toBe(
      'copy-only'
    );
  });
});

describe('shareFileName', () => {
  it('slugs the title and keeps the media extension', () => {
    expect(shareFileName({ title: 'Open this weekend: Fri and Sat', extension: 'png' })).toBe(
      'open-this-weekend-fri-and-sat.png'
    );
    expect(shareFileName({ title: 'Weekend escape', extension: 'mp4' })).toBe(
      'weekend-escape.mp4'
    );
  });

  it('never returns an empty name', () => {
    expect(shareFileName({ title: '   ', extension: 'png' })).toBe('marketing-post.png');
  });
});

describe('shareReminderText', () => {
  it('reads like a reminder a host would accept', () => {
    expect(
      shareReminderText({ title: 'Open this weekend', channelLabel: 'Facebook groups' })
    ).toBe('Time to post: Open this weekend (Facebook groups)');
  });

  it('has no em dash', () => {
    expect(shareReminderText({ title: 'x', channelLabel: 'y' })).not.toContain('\u2014');
  });
});

describe('extensionForMedia', () => {
  it('maps video mime types to mp4 and everything else to png', () => {
    expect(extensionForMedia('video/mp4')).toBe('mp4');
    expect(extensionForMedia('video/webm')).toBe('mp4');
    expect(extensionForMedia('image/jpeg')).toBe('png');
    expect(extensionForMedia(null)).toBe('png');
  });
});
