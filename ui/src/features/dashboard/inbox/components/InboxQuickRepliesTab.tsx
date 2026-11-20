import { useMemo, useState } from 'react';

import { MessageSquare, Pencil, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { InboxQuickReplyFormDialog } from '@/features/dashboard/inbox/components/InboxQuickReplyFormDialog';
import { QuickReplyGroupFilters } from '@/features/dashboard/inbox/components/QuickReplyGroupTabs';
import {
  INBOX_PINNED_SNIPPETS_MAX,
  sortTemplatesWithPins,
  type InboxPinnedSnippet,
} from '@/features/dashboard/inbox/lib/inboxPinnedSnippets';
import {
  defaultQuickReplyGroupForTab,
  quickReplyGroupLabel,
  templateMatchesQuickReplyTab,
  type QuickReplyGroupTab,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';
import type {
  InboxTemplate,
  SaveInboxTemplatePayload,
} from '@/features/dashboard/inbox/types/inbox';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  templates: InboxTemplate[];
  isLoading: boolean;
  saving: boolean;
  onSave: (payload: SaveInboxTemplatePayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Property Messages only: pin reply into Insert → Pinned (max 5). */
  pinningEnabled?: boolean;
  pinnedIds?: string[];
  pinnedSnippets?: InboxPinnedSnippet[];
  pinning?: boolean;
  onTogglePin?: (template: InboxTemplate) => Promise<void>;
  onUnpinId?: (id: string) => Promise<void>;
};

export function InboxQuickRepliesTab({
  templates,
  isLoading,
  saving,
  onSave,
  onDelete,
  pinningEnabled = false,
  pinnedIds = [],
  pinnedSnippets = [],
  pinning = false,
  onTogglePin,
  onUnpinId,
}: Props) {
  const [groupTab, setGroupTab] = useState<QuickReplyGroupTab>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InboxTemplate | null>(null);

  const orphanPins = useMemo(() => {
    if (!pinningEnabled) return [];
    const templateIds = new Set(templates.map((t) => t.id));
    return pinnedSnippets.filter((row) => !templateIds.has(row.id));
  }, [pinningEnabled, pinnedSnippets, templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = templates.filter((t) => templateMatchesQuickReplyTab(t, groupTab));
    rows = pinningEnabled
      ? sortTemplatesWithPins(rows, pinnedIds)
      : [...rows].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    if (!q) return rows;
    return rows.filter(
      (t) => t.title.toLowerCase().includes(q) || t.body_text.toLowerCase().includes(q)
    );
  }, [templates, search, groupTab, pinningEnabled, pinnedIds]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (template: InboxTemplate) => {
    setEditing(template);
    setFormOpen(true);
  };

  const handleDelete = async (template: InboxTemplate) => {
    try {
      await onDelete(template.id);
      toast.success('Deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleTogglePin = async (template: InboxTemplate) => {
    if (!onTogglePin) return;
    try {
      await onTogglePin(template);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const emptyLabel =
    search.trim() !== ''
      ? 'No replies match your search'
      : groupTab === 'all'
        ? 'No quick replies yet'
        : `No ${quickReplyGroupLabel(groupTab).toLowerCase()} replies yet`;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search replies"
            className="h-10 pl-9"
            aria-label="Search quick replies"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-3 w-16" aria-hidden />
            ) : (
              <p className="text-muted-foreground shrink-0 text-xs">
                {`${filtered.length} ${filtered.length === 1 ? 'reply' : 'replies'}`}
              </p>
            )}
            <QuickReplyGroupFilters value={groupTab} onChange={setGroupTab} />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 min-h-[44px] shrink-0 gap-1.5 sm:min-h-9"
            onClick={openCreate}
          >
            <Plus className="size-4" aria-hidden />
            New reply
          </Button>
        </div>

        <div className="border-border min-h-[min(50dvh,420px)] flex-1 overflow-y-auto rounded-lg border">
          {isLoading ? (
            <div className="divide-border divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 && orphanPins.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
              <MessageSquare className="text-muted-foreground/50 size-8" aria-hidden />
              <p className="text-muted-foreground mt-3 text-sm">{emptyLabel}</p>
              {!search.trim() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-[44px]"
                  onClick={openCreate}
                >
                  New reply
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {!search.trim() &&
                orphanPins.map((snippet) => (
                  <li key={`orphan-${snippet.id}`}>
                    <div className="flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{snippet.title}</p>
                          <Badge variant="secondary" className="gap-1 px-2 py-0 font-medium">
                            <Pin className="size-3" aria-hidden />
                            Pinned
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">
                          {snippet.bodyText}
                        </p>
                      </div>
                      {onUnpinId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 min-h-[44px] min-w-[44px]"
                          aria-label={`Unpin ${snippet.title}`}
                          title="Unpin"
                          disabled={pinning}
                          onClick={() => void onUnpinId(snippet.id)}
                        >
                          <Pin className="size-4 fill-current" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              {filtered.map((template) => {
                const pinned = pinningEnabled && pinnedIds.includes(template.id);
                return (
                  <li key={template.id}>
                    <div className="group flex items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
                      <button
                        type="button"
                        className="hover:bg-muted/40 -mx-1 min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition-colors"
                        onClick={() => openEdit(template)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{template.title}</p>
                          {pinned ? (
                            <Badge variant="secondary" className="gap-1 px-2 py-0 font-medium">
                              <Pin className="size-3" aria-hidden />
                              Pinned
                            </Badge>
                          ) : null}
                          {groupTab === 'all' && template.platform && (
                            <Badge variant="outline" className="px-2 py-0 font-medium">
                              {quickReplyGroupLabel(
                                template.platform === 'facebook' ||
                                  template.platform === 'instagram'
                                  ? template.platform
                                  : 'all'
                              )}
                            </Badge>
                          )}
                          {groupTab === 'all' && !template.platform && (
                            <Badge variant="secondary" className="px-2 py-0 font-medium">
                              All
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed">
                          {template.body_text}
                        </p>
                      </button>
                      <div className="flex shrink-0 gap-0.5">
                        {pinningEnabled && onTogglePin ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'size-10 min-h-[44px] min-w-[44px]',
                              pinned && 'text-foreground'
                            )}
                            aria-label={
                              pinned ? `Unpin ${template.title}` : `Pin ${template.title}`
                            }
                            title={
                              pinned
                                ? 'Unpin'
                                : pinnedIds.length >= INBOX_PINNED_SNIPPETS_MAX
                                  ? `Max ${INBOX_PINNED_SNIPPETS_MAX} pins`
                                  : 'Pin for Insert'
                            }
                            disabled={pinning || saving}
                            onClick={() => void handleTogglePin(template)}
                          >
                            <Pin
                              className={cn('size-4', pinned && 'fill-current')}
                              aria-hidden
                            />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 min-h-[44px] min-w-[44px]"
                          aria-label={`Edit ${template.title}`}
                          onClick={() => openEdit(template)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive size-10 min-h-[44px] min-w-[44px]"
                          aria-label={`Delete ${template.title}`}
                          onClick={() => void handleDelete(template)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <InboxQuickReplyFormDialog
        open={formOpen}
        template={editing}
        defaultGroup={defaultQuickReplyGroupForTab(groupTab)}
        saving={saving}
        onOpenChange={setFormOpen}
        onSave={onSave}
      />
    </>
  );
}
