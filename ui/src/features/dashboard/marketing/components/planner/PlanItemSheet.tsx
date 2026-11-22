import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MODAL_BODY_CLASS,
  MODAL_FOOTER_CLASS,
  MODAL_HEADER_CLASS,
} from '@/components/ui/modal-chrome';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { channelLabel, formatLabel } from '@/features/dashboard/marketing/lib/planner/planItemStatus';
import {
  describeClaimLines,
  fromDatetimeLocal,
  toDatetimeLocal,
} from '@/features/dashboard/marketing/lib/planner/plannerRange';
import type { PlannerItemDto } from '@/features/dashboard/marketing/lib/planner/plannerApi';
import { togglePhotoSelection } from '@/features/dashboard/marketing/lib/planner/plannerPhotos';

const FORMATS = ['post', 'carousel', 'story', 'reel', 'calendar'] as const;

type Draft = {
  title: string;
  hook: string;
  message: string;
  cta: string;
  scheduledFor: string;
  format: string;
  photoUrls: string[];
};

function draftFrom(item: PlannerItemDto): Draft {
  return {
    title: item.title,
    hook: item.brief.hook ?? '',
    message: item.brief.message ?? '',
    cta: item.brief.cta ?? '',
    scheduledFor: toDatetimeLocal(item.scheduledFor),
    format: item.format,
    photoUrls: item.brief.photoUrls ?? [],
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.hook === b.hook &&
    a.message === b.message &&
    a.cta === b.cta &&
    a.scheduledFor === b.scheduledFor &&
    a.format === b.format &&
    a.photoUrls.join(',') === b.photoUrls.join(',')
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlannerItemDto | null;
  isSaving?: boolean;
  onSave: (item: PlannerItemDto, patch: Record<string, unknown>) => Promise<boolean> | boolean;
  /** Present only when the host can use AI briefs; the buttons stay hidden otherwise. */
  onRefresh?: (
    item: PlannerItemDto,
    instruction: 'shorter' | 'playful' | 'taglish'
  ) => Promise<PlannerItemDto | null>;
  isRefreshing?: boolean;
  /** Opens the editor that finishes this item and copies the caption. */
  onOpenEditor?: (item: PlannerItemDto) => void;
  /** Ranked gallery photos to suggest for this item. */
  photoOptions?: string[];
};

export function PlanItemSheet({
  open,
  onOpenChange,
  item,
  isSaving,
  onSave,
  onRefresh,
  isRefreshing,
  onOpenEditor,
  photoOptions = [],
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (open && item) {
      setDraft(draftFrom(item));
      setEditing(false);
    }
  }, [open, item]);

  const isDirty = Boolean(draft && item && !sameDraft(draft, draftFrom(item)));

  const save = async (): Promise<boolean> => {
    if (!item || !draft) return false;
    const scheduledFor = fromDatetimeLocal(draft.scheduledFor);
    const patch: Record<string, unknown> = {};
    if (scheduledFor && scheduledFor !== item.scheduledFor) patch.scheduledFor = scheduledFor;
    if (draft.format !== item.format) patch.format = draft.format;
    if (draft.title !== item.title) patch.title = draft.title;
    const brief: Record<string, unknown> = {};
    if (draft.hook !== (item.brief.hook ?? '')) brief.hook = draft.hook;
    if (draft.message !== (item.brief.message ?? '')) brief.message = draft.message;
    if (draft.cta !== (item.brief.cta ?? '')) brief.cta = draft.cta;
    if (draft.photoUrls.join(',') !== (item.brief.photoUrls ?? []).join(',')) {
      brief.photoUrls = draft.photoUrls;
    }
    if (Object.keys(brief).length > 0) patch.brief = brief;
    if (Object.keys(patch).length === 0) return true;
    return onSave(item, patch);
  };

  const guard = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: async () => ((await save()) ? true : false),
    onDiscard: () => {
      if (item) setDraft(draftFrom(item));
      setEditing(false);
    },
  });

  if (!item || !draft) return null;

  const claims = describeClaimLines(item.claims);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guard.onOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,40rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0"
        >
          <ResponsiveModalHeader className={cn(MODAL_HEADER_CLASS, 'space-y-0 text-left')}>
            <ResponsiveModalTitle>{item.title}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div
            className={cn(
              'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]',
              MODAL_BODY_CLASS
            )}
          >
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3.5">
              {draft.hook ? <p className="text-sm font-medium leading-snug">{draft.hook}</p> : null}
              {draft.message ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{draft.message}</p>
              ) : null}
              {draft.cta ? <p className="text-caption text-muted-foreground">{draft.cta}</p> : null}
              <p className="text-caption text-muted-foreground">
                {channelLabel(item.channelKind)} · {formatLabel(draft.format)}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                Why this post
              </p>
              {item.brief.why ? (
                <p className="text-sm leading-snug">{item.brief.why}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Suggested from your calendar data.</p>
              )}
              {claims.length > 0 ? (
                <ul className="space-y-0.5 text-sm">
                  {claims.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dates or prices in this post.</p>
              )}
              <p className="text-caption text-muted-foreground">
                We pause this if the dates book or the price changes.
              </p>
            </div>

            {item.trackedVisits > 0 || item.insights ? (
              <div className="space-y-1.5">
                <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                  Results
                </p>
                {item.trackedVisits > 0 ? (
                  <p className="text-sm">
                    {item.trackedVisits}{' '}
                    {item.trackedVisits === 1 ? 'visit' : 'visits'} from this link
                  </p>
                ) : null}
                {item.insights?.views != null ? (
                  <p className="text-sm">{item.insights.views} views</p>
                ) : null}
                {item.insights?.reach != null ? (
                  <p className="text-sm">{item.insights.reach} reached</p>
                ) : null}
              </div>
            ) : null}

            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit copy
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="planner-item-title" className="text-caption text-muted-foreground">
                    Title
                  </label>
                  <Input
                    id="planner-item-title"
                    value={draft.title}
                    maxLength={120}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="planner-item-hook" className="text-caption text-muted-foreground">
                    First line
                  </label>
                  <Input
                    id="planner-item-hook"
                    value={draft.hook}
                    maxLength={80}
                    onChange={(event) => setDraft({ ...draft, hook: event.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="planner-item-message"
                    className="text-caption text-muted-foreground"
                  >
                    Caption
                  </label>
                  <textarea
                    id="planner-item-message"
                    value={draft.message}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background p-2 text-sm"
                    onChange={(event) => setDraft({ ...draft, message: event.target.value })}
                  />
                </div>

                {onRefresh ? (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['shorter', 'Shorter'],
                        ['playful', 'More playful'],
                        ['taglish', 'Taglish'],
                      ] as const
                    ).map(([instruction, label]) => (
                      <Button
                        key={instruction}
                        size="sm"
                        variant="outline"
                        disabled={isRefreshing}
                        onClick={async () => {
                          const next = await onRefresh(item, instruction);
                          if (next) setDraft(draftFrom(next));
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label htmlFor="planner-item-cta" className="text-caption text-muted-foreground">
                    Call to action
                  </label>
                  <Input
                    id="planner-item-cta"
                    value={draft.cta}
                    maxLength={40}
                    onChange={(event) => setDraft({ ...draft, cta: event.target.value })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="planner-item-schedule"
                      className="text-caption text-muted-foreground"
                    >
                      When
                    </label>
                    <Input
                      id="planner-item-schedule"
                      type="datetime-local"
                      value={draft.scheduledFor}
                      onChange={(event) => setDraft({ ...draft, scheduledFor: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-caption text-muted-foreground">Format</span>
                    <Select
                      value={draft.format}
                      onValueChange={(next) => setDraft({ ...draft, format: next })}
                    >
                      <SelectTrigger aria-label="Format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((format) => (
                          <SelectItem key={format} value={format}>
                            {formatLabel(format)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {photoOptions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-caption text-muted-foreground">Suggested photos</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {photoOptions.map((url) => {
                        const selected = draft.photoUrls.includes(url);
                        return (
                          <button
                            key={url}
                            type="button"
                            aria-pressed={selected}
                            aria-label={selected ? 'Remove photo' : 'Use photo'}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                photoUrls: togglePhotoSelection(draft.photoUrls, url, 5),
                              })
                            }
                            className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                              selected ? 'border-primary' : 'border-transparent'
                            }`}
                          >
                            <img
                              src={url}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <ResponsiveModalFooter className={cn(MODAL_FOOTER_CLASS, 'flex flex-wrap gap-2')}>
            {onOpenEditor ? (
              <Button size="sm" onClick={() => onOpenEditor(item)}>
                Make this
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={guard.requestClose}>
              Cancel
            </Button>
            {editing ? (
              <Button
                size="sm"
                disabled={!isDirty || isSaving}
                onClick={async () => {
                  if (await save()) guard.onOpenChange(false);
                }}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </>
  );
}
