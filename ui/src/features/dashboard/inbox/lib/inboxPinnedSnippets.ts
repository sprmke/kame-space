export type InboxPinnedSnippet = {
  id: string;
  title: string;
  bodyText: string;
};

export type InboxPinnedSnippetSource = {
  id: string;
  title: string;
  body_text: string;
};

export const INBOX_PINNED_SNIPPETS_MAX = 5;

function normalizeSnippet(raw: unknown): InboxPinnedSnippet | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const title = String(row.title ?? '').trim();
  const bodyText = String(row.bodyText ?? row.body_text ?? '').trim();
  if (!id || !title || !bodyText) return null;
  if (title.length > 80) return null;
  if (bodyText.length > 2000) return null;
  return { id, title, bodyText };
}

export function readInboxPinnedSnippets(
  settings: Record<string, unknown> | null | undefined
): InboxPinnedSnippet[] {
  const raw = settings?.inboxPinnedSnippets;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSnippet)
    .filter((row): row is InboxPinnedSnippet => row !== null)
    .slice(0, INBOX_PINNED_SNIPPETS_MAX);
}

export function newInboxPinnedSnippetId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `snippet-${Date.now()}`;
}

/** Live title/body from matching quick replies; keep legacy freeform pins as stored. */
export function resolvePinnedSnippets(
  settings: Record<string, unknown> | null | undefined,
  templates: ReadonlyArray<InboxPinnedSnippetSource> = []
): InboxPinnedSnippet[] {
  const stored = readInboxPinnedSnippets(settings);
  if (templates.length === 0) return stored;
  const byId = new Map(templates.map((t) => [t.id, t]));
  return stored.map((snippet) => {
    const live = byId.get(snippet.id);
    if (!live) return snippet;
    return {
      id: snippet.id,
      title: live.title,
      bodyText: live.body_text,
    };
  });
}

export function isQuickReplyPinned(
  snippets: ReadonlyArray<Pick<InboxPinnedSnippet, 'id'>>,
  templateId: string
): boolean {
  return snippets.some((row) => row.id === templateId);
}

export type TogglePinnedQuickReplyResult =
  | { ok: true; next: InboxPinnedSnippet[] }
  | { ok: false; reason: 'max' };

/** Pin or unpin a quick reply (id = template id). Max 5 pins. */
export function togglePinnedQuickReply(
  snippets: ReadonlyArray<InboxPinnedSnippet>,
  template: InboxPinnedSnippetSource
): TogglePinnedQuickReplyResult {
  if (isQuickReplyPinned(snippets, template.id)) {
    return {
      ok: true,
      next: snippets.filter((row) => row.id !== template.id),
    };
  }
  if (snippets.length >= INBOX_PINNED_SNIPPETS_MAX) {
    return { ok: false, reason: 'max' };
  }
  const title = template.title.trim().slice(0, 80);
  const bodyText = template.body_text.trim().slice(0, 2000);
  if (!title || !bodyText) {
    return { ok: true, next: [...snippets] };
  }
  return {
    ok: true,
    next: [
      ...snippets,
      {
        id: template.id,
        title,
        bodyText,
      },
    ],
  };
}

export function removePinnedQuickReply(
  snippets: ReadonlyArray<InboxPinnedSnippet>,
  templateId: string
): InboxPinnedSnippet[] {
  return snippets.filter((row) => row.id !== templateId);
}

/** Pinned templates first (pin order), then remaining by sort_order / title. */
export function sortTemplatesWithPins<
  T extends { id: string; title: string; sort_order: number },
>(templates: ReadonlyArray<T>, pinnedIds: ReadonlyArray<string>): T[] {
  const pinIndex = new Map(pinnedIds.map((id, i) => [id, i]));
  return [...templates].sort((a, b) => {
    const aPin = pinIndex.get(a.id);
    const bPin = pinIndex.get(b.id);
    const aPinned = aPin !== undefined;
    const bPinned = bPin !== undefined;
    if (aPinned && bPinned) return (aPin ?? 0) - (bPin ?? 0);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
  });
}
