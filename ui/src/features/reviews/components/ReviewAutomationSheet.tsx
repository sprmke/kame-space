import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { usePropertyReviews } from '@/features/reviews/hooks/usePropertyReviews';
import {
  useReviewAutomationRules,
  useSaveReviewAutomationRules,
} from '@/features/reviews/hooks/useReviewAutomation';
import { defaultReviewsQuery } from '@/features/reviews/lib/propertyReviewsApi';
import {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  type ReviewAutomationRules,
} from '@/features/reviews/lib/reviewAutomationApi';
import { REVIEW_WINDOW_DAYS } from '@/features/reviews/lib/reviewWindow';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ResponsiveModalTitle } from '@/components/ui/responsive-modal';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';

/** Mirrors `_shared/reviewAutomationTemplates.ts`. */
const MIN_TEMPLATES = 3;
const MIN_DELAY = 1;
const MAX_DELAY = 13;

/** Fills the two supported placeholders for the preview line. */
function renderPreview(
  template: string | undefined,
  guestName: string | null,
  propertyName: string | null
): string | null {
  const text = template?.trim();
  if (!text) return null;
  return text
    .replace(/\{\{guest_first_name\}\}/g, guestName || 'Your guest')
    .replace(/\{\{property_name\}\}/g, propertyName || 'your property');
}

const CATEGORY_FIELDS = [
  ['cleanlinessRating', 'Left the place clean'],
  ['communicationRating', 'Communication'],
  ['houseRulesRating', 'Followed house rules'],
] as const;

const SKIP_FIELDS = [
  ['skipOnIssueTags', 'The guest left issue tags'],
  ['skipOnOpenMaintenance', 'Maintenance is open'],
  ['skipOnSdDeduction', 'The deposit was reduced'],
] as const;

function rulesEqual(a: ReviewAutomationRules, b: ReviewAutomationRules): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-section-title">{title}</h3>
        {hint ? <p className="text-caption mt-1">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
};

/**
 * Auto-review rules for this property. Lives in a sheet rather than on the
 * Reviews list so the list stays a list; opened from the page header.
 *
 * Preview-open below Pro: the form reads, Enable / Save raise the upgrade prompt.
 */
export function ReviewAutomationSheet({ open, onOpenChange, canEdit }: Props) {
  const query = useReviewAutomationRules();
  const save = useSaveReviewAutomationRules();
  const orgContext = useOptionalOrgContext();
  // One real pending stay, so "what it posts" can be previewed with a real name.
  const pendingReviews = usePropertyReviews('to_write', defaultReviewsQuery('to_write'), {
    enabled: open,
  });
  const previewGuest = pendingReviews.data?.items[0]?.guestName ?? null;
  const previewProperty = orgContext?.property?.name ?? null;
  const { canUse } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const baseline = query.data ?? DEFAULT_REVIEW_AUTOMATION_RULES;
  const [form, setForm] = useState<ReviewAutomationRules>(baseline);

  useEffect(() => {
    setForm(baseline);
  }, [baseline]);

  const isDirty = useMemo(() => !rulesEqual(form, baseline), [form, baseline]);
  const filledTemplates = form.templates.filter((template) => template.trim()).length;
  const templatesShort = form.enabled && filledTemplates < MIN_TEMPLATES;
  const disabled = !canEdit;

  const handleSave = async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (!canUse) {
      openUpgradeModal('reviewAutomation');
      return false;
    }
    if (templatesShort) {
      toast.error(`Add at least ${MIN_TEMPLATES} templates`);
      return false;
    }
    try {
      const saved = await save.mutateAsync(form);
      setForm(saved);
      toast.success('Auto-review saved');
      return true;
    } catch (err) {
      if (err instanceof Error) handleAiMutationError(err);
      else toast.error('Could not save auto-review');
      return false;
    }
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: canEdit && isDirty,
    onSave: handleSave,
    onDiscard: () => setForm(baseline),
    enabled: canEdit,
  });

  const setEnabled = (enabled: boolean) => {
    if (!canUse) {
      openUpgradeModal('reviewAutomation');
      return;
    }
    setForm((prev) => ({ ...prev, enabled }));
  };

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        sizeClassName="max-w-[min(calc(100vw-1.5rem),34rem)] sm:max-w-[min(90vw,34rem)]"
        title={
          // A JSX title must carry ResponsiveModalTitle itself, or the dialog has no
          // accessible name at all (AdminDialogShell only wraps string titles).
          <ResponsiveModalTitle className="flex items-center gap-2">
            Auto-review
            <TierBadge feature="reviewAutomation" />
          </ResponsiveModalTitle>
        }
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            {canEdit ? (
              <Button
                type="button"
                className="min-h-[44px]"
                disabled={!isDirty || save.isPending}
                onClick={() => void handleSave()}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-6">
          <div className="border-border flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
            <Label htmlFor="auto-review-enabled" className="text-sm font-medium">
              Review guests automatically
            </Label>
            <Switch
              id="auto-review-enabled"
              checked={form.enabled}
              disabled={disabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <Section
            title="Timing"
            hint={`${MIN_DELAY}–${MAX_DELAY} days, inside the ${REVIEW_WINDOW_DAYS}-day review window.`}
          >
            <div
              role="group"
              aria-labelledby="auto-review-delay-label"
              className="flex items-center justify-between gap-3"
            >
              <span id="auto-review-delay-label" className="settings-field-label">
                Days after checkout
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  className="size-11 shrink-0 p-0"
                  disabled={disabled || form.delayDays <= MIN_DELAY}
                  aria-label="Fewer days"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      delayDays: Math.max(MIN_DELAY, prev.delayDays - 1),
                    }))
                  }
                >
                  <Minus className="size-4" aria-hidden />
                </Button>
                <span
                  aria-live="polite"
                  className="text-foreground min-w-8 text-center text-sm font-semibold tabular-nums"
                >
                  {form.delayDays}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="size-11 shrink-0 p-0"
                  disabled={disabled || form.delayDays >= MAX_DELAY}
                  aria-label="More days"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      delayDays: Math.min(MAX_DELAY, prev.delayDays + 1),
                    }))
                  }
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </Section>

          <Section title="What it posts" hint="Every auto-review uses these ratings.">
            <div className="space-y-1">
              <div className="border-border/50 flex min-h-[44px] flex-col items-start gap-0.5 border-b py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-foreground text-sm">Overall</span>
                <GuestReviewStarRating
                  size="compact"
                  value={form.overallRating}
                  disabled={disabled}
                  ariaLabel="Overall rating"
                  className="-ml-3 shrink-0 sm:ml-0"
                  onChange={(rating) => setForm((prev) => ({ ...prev, overallRating: rating }))}
                />
              </div>
              {CATEGORY_FIELDS.map(([key, label]) => (
                <div
                  key={key}
                  className="border-border/50 flex min-h-[44px] flex-col items-start gap-0.5 border-b py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <span className="text-foreground text-sm">{label}</span>
                  <GuestReviewStarRating
                    size="compact"
                    value={form[key]}
                    disabled={disabled}
                    ariaLabel={`${label} rating`}
                    className="-ml-3 shrink-0 sm:ml-0"
                    onChange={(rating) => setForm((prev) => ({ ...prev, [key]: rating }))}
                  />
                </div>
              ))}
              <div className="flex min-h-[44px] items-center justify-between gap-3 py-2">
                <Label htmlFor="auto-review-host-again" className="text-sm font-normal">
                  Would host again
                </Label>
                <Switch
                  id="auto-review-host-again"
                  checked={form.wouldHostAgain}
                  disabled={disabled}
                  onCheckedChange={(wouldHostAgain) =>
                    setForm((prev) => ({ ...prev, wouldHostAgain }))
                  }
                />
              </div>
            </div>
          </Section>

          <Section
            title="Templates"
            hint="One is picked at random. Use {{guest_first_name}} and {{property_name}}."
          >
            <div className="space-y-2">
              {renderPreview(form.templates[0], previewGuest, previewProperty) ? (
                <div className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    Preview
                  </p>
                  <p className="text-foreground mt-1 text-sm leading-relaxed">
                    {renderPreview(form.templates[0], previewGuest, previewProperty)}
                  </p>
                </div>
              ) : null}
              {form.templates.map((template, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Textarea
                    value={template}
                    disabled={disabled}
                    rows={2}
                    aria-label={`Template ${index + 1}`}
                    onChange={(event) =>
                      setForm((prev) => {
                        const templates = [...prev.templates];
                        templates[index] = event.target.value;
                        return { ...prev, templates };
                      })
                    }
                  />
                  {form.templates.length > MIN_TEMPLATES ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive size-10 shrink-0 p-0"
                      disabled={disabled}
                      aria-label={`Remove template ${index + 1}`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          templates: prev.templates.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              {templatesShort ? (
                <p role="alert" className="text-destructive text-xs font-medium">
                  Add at least {MIN_TEMPLATES} templates to turn this on.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="settings-action"
                disabled={disabled}
                onClick={() => setForm((prev) => ({ ...prev, templates: [...prev.templates, ''] }))}
              >
                Add template
              </Button>
            </div>
          </Section>

          <Section title="Skip when">
            <div className="space-y-1">
              {SKIP_FIELDS.map(([key, label]) => (
                <div key={key} className="flex min-h-[44px] items-center gap-3">
                  <Checkbox
                    id={`auto-review-${key}`}
                    checked={form[key]}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, [key]: checked === true }))
                    }
                  />
                  <Label htmlFor={`auto-review-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
