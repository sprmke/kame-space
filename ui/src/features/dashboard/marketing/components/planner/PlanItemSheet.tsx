import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
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

const FORMATS = ['post', 'carousel', 'story', 'reel', 'calendar'] as const;

type Draft = {
  title: string;
  hook: string;
  message: string;
  cta: string;
  scheduledFor: string;
  format: string;
};

function draftFrom(item: PlannerItemDto): Draft {
  return {
    title: item.title,
    hook: item.brief.hook ?? '',
    message: item.brief.message ?? '',
    cta: item.brief.cta ?? '',
    scheduledFor: toDatetimeLocal(item.scheduledFor),
    format: item.format,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.hook === b.hook &&
    a.message === b.message &&
    a.cta === b.cta &&
    a.scheduledFor === b.scheduledFor &&
    a.format === b.format
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PlannerItemDto | null;
  isSaving?: boolean;
  onSave: (item: PlannerItemDto, patch: Record<string, unknown>) => Promise<boolean> | boolean;
};

export function PlanItemSheet({ open, onOpenChange, item, isSaving, onSave }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (open && item) setDraft(draftFrom(item));
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
    if (Object.keys(brief).length > 0) patch.brief = brief;
    if (Object.keys(patch).length === 0) return true;
    return onSave(item, patch);
  };

  const guard = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: async () => ((await save()) ? true : false),
    onDiscard: () => item && setDraft(draftFrom(item)),
  });

  if (!item || !draft) return null;

  const claims = describeClaimLines(item.claims);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guard.onOpenChange}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{item.title}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

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
              <label htmlFor="planner-item-message" className="text-caption text-muted-foreground">
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

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-caption text-muted-foreground">
                {channelLabel(item.channelKind)} · what this says
              </p>
              {claims.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {claims.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">No dates or prices claimed.</p>
              )}
              {item.brief.why ? (
                <p className="mt-2 text-caption text-muted-foreground">{item.brief.why}</p>
              ) : null}
            </div>
          </div>

          <ResponsiveModalFooter className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!isDirty || isSaving}
              onClick={async () => {
                if (await save()) guard.onOpenChange(false);
              }}
            >
              {isSaving ? 'Saving' : 'Save'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </>
  );
}
