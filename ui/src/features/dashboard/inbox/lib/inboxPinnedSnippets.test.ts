import { describe, expect, it } from 'vitest';

import {
  INBOX_PINNED_SNIPPETS_MAX,
  isQuickReplyPinned,
  readInboxPinnedSnippets,
  removePinnedQuickReply,
  resolvePinnedSnippets,
  sortTemplatesWithPins,
  togglePinnedQuickReply,
} from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';

describe('readInboxPinnedSnippets', () => {
  it('returns empty for missing settings', () => {
    expect(readInboxPinnedSnippets(null)).toEqual([]);
    expect(readInboxPinnedSnippets({})).toEqual([]);
  });

  it('normalizes valid rows and drops bad ones', () => {
    expect(
      readInboxPinnedSnippets({
        inboxPinnedSnippets: [
          { id: 'a', title: 'Hi', bodyText: 'Hello' },
          { id: 'b', title: 'Snake', body_text: 'World' },
          { id: '', title: 'Bad', bodyText: 'x' },
          { title: 'No id', bodyText: 'x' },
        ],
      })
    ).toEqual([
      { id: 'a', title: 'Hi', bodyText: 'Hello' },
      { id: 'b', title: 'Snake', bodyText: 'World' },
    ]);
  });

  it('caps at max', () => {
    const rows = Array.from({ length: INBOX_PINNED_SNIPPETS_MAX + 2 }, (_, i) => ({
      id: `id-${i}`,
      title: `T${i}`,
      bodyText: `B${i}`,
    }));
    expect(readInboxPinnedSnippets({ inboxPinnedSnippets: rows })).toHaveLength(
      INBOX_PINNED_SNIPPETS_MAX
    );
  });
});

describe('resolvePinnedSnippets', () => {
  it('refreshes title and body from matching templates', () => {
    const settings = {
      inboxPinnedSnippets: [{ id: 't1', title: 'Old', bodyText: 'Old body' }],
    };
    expect(
      resolvePinnedSnippets(settings, [{ id: 't1', title: 'New', body_text: 'New body' }])
    ).toEqual([{ id: 't1', title: 'New', bodyText: 'New body' }]);
  });

  it('keeps freeform pins without a matching template', () => {
    const settings = {
      inboxPinnedSnippets: [{ id: 'custom', title: 'Custom', bodyText: 'Free' }],
    };
    expect(resolvePinnedSnippets(settings, [{ id: 'other', title: 'X', body_text: 'Y' }])).toEqual([
      { id: 'custom', title: 'Custom', bodyText: 'Free' },
    ]);
  });
});

describe('togglePinnedQuickReply', () => {
  it('pins a quick reply', () => {
    const result = togglePinnedQuickReply([], {
      id: 't1',
      title: 'Rates',
      body_text: 'Our rates…',
    });
    expect(result).toEqual({
      ok: true,
      next: [{ id: 't1', title: 'Rates', bodyText: 'Our rates…' }],
    });
  });

  it('unpins when already pinned', () => {
    const current = [{ id: 't1', title: 'Rates', bodyText: 'Our rates…' }];
    const result = togglePinnedQuickReply(current, {
      id: 't1',
      title: 'Rates',
      body_text: 'Our rates…',
    });
    expect(result).toEqual({ ok: true, next: [] });
  });

  it('rejects when at max', () => {
    const current = Array.from({ length: INBOX_PINNED_SNIPPETS_MAX }, (_, i) => ({
      id: `id-${i}`,
      title: `T${i}`,
      bodyText: `B${i}`,
    }));
    const result = togglePinnedQuickReply(current, {
      id: 'extra',
      title: 'Extra',
      body_text: 'More',
    });
    expect(result).toEqual({ ok: false, reason: 'max' });
  });
});

describe('isQuickReplyPinned / removePinnedQuickReply', () => {
  it('detects and removes by template id', () => {
    const rows = [{ id: 't1', title: 'A', bodyText: 'B' }];
    expect(isQuickReplyPinned(rows, 't1')).toBe(true);
    expect(isQuickReplyPinned(rows, 't2')).toBe(false);
    expect(removePinnedQuickReply(rows, 't1')).toEqual([]);
  });
});

describe('sortTemplatesWithPins', () => {
  it('puts pinned ids first in pin order', () => {
    const templates = [
      { id: 'a', title: 'A', sort_order: 0 },
      { id: 'b', title: 'B', sort_order: 1 },
      { id: 'c', title: 'C', sort_order: 2 },
    ];
    expect(sortTemplatesWithPins(templates, ['c', 'a']).map((t) => t.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});
