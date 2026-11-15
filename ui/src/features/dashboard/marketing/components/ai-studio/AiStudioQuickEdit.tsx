import { useMemo, useState } from 'react';

import { Check } from 'lucide-react';

import {
  POSTER_FAMILY_LABEL,
  QUICK_EDIT_TEXT_SLOTS,
  heroPhotoUrl,
  layoutChoices,
  overLimitSlots,
  quickEditCharLimit,
  setHeroPhoto,
  setPosterLayout,
  setPosterText,
  setPosterToggle,
  type PosterToggles,
  type QuickEditTextKey,
} from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import {
  POSTER_ARCHETYPE_FAMILY,
  type PosterArchetypeId,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Switch } from '@/components/ui/switch';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

export type QuickEditResult = { spec: PosterSpec; photoUrls: string[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: PosterSpec;
  /** The photos this post places (indexes in `spec.photoIndexes` point here). */
  photoUrls: string[];
  /** Every photo the host can swap in (the listing). */
  libraryPhotos: string[];
  /** Which modules the listing has facts for. */
  available: Record<keyof PosterToggles, boolean>;
  /** In a theme the type is the theme's: a layout change keeps it. */
  keepFonts: boolean;
  saving: boolean;
  onApply: (result: QuickEditResult) => Promise<boolean> | boolean;
};

const TOGGLES: Array<{ key: keyof PosterToggles; label: string }> = [
  { key: 'logo', label: 'Logo' },
  { key: 'infoBar', label: 'Check-in and check-out' },
  { key: 'location', label: 'Location' },
];

const layoutName = (id: PosterArchetypeId) =>
  id.replace(/-/g, ' ').replace(/^./, (char) => char.toUpperCase());

/**
 * Free, instant edits: retype the words, swap the photo, pick another layout, switch
 * modules. No AI call and no credits; Apply saves a new version. Closing with unsaved
 * edits asks first.
 */
export function AiStudioQuickEdit({
  open,
  onOpenChange,
  spec,
  photoUrls,
  libraryPhotos,
  available,
  keepFonts,
  saving,
  onApply,
}: Props) {
  const initialText = useMemo(
    () =>
      Object.fromEntries(
        QUICK_EDIT_TEXT_SLOTS.map((slot) => [slot.key, spec.copy[slot.key]])
      ) as Record<QuickEditTextKey, string>,
    [spec]
  );
  const [text, setText] = useState(initialText);
  const [draft, setDraft] = useState<QuickEditResult>({ spec, photoUrls });

  const textChanged = QUICK_EDIT_TEXT_SLOTS.some(
    (slot) => text[slot.key] !== initialText[slot.key]
  );
  const dirty =
    textChanged || JSON.stringify(draft) !== JSON.stringify({ spec, photoUrls }) || false;
  const tooLong = overLimitSlots(text);

  const build = (): QuickEditResult => {
    let next = draft.spec;
    for (const slot of QUICK_EDIT_TEXT_SLOTS) {
      if (text[slot.key] !== initialText[slot.key])
        next = setPosterText(next, slot.key, text[slot.key]);
    }
    return { spec: next, photoUrls: draft.photoUrls };
  };

  const apply = async (): Promise<boolean> => {
    if (tooLong.length > 0) return false;
    const done = await onApply(build());
    return done !== false;
  };

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty: dirty,
    onSave: apply,
  });

  const hero = heroPhotoUrl(draft.spec, draft.photoUrls);
  const patch = (next: PosterSpec) => setDraft((current) => ({ ...current, spec: next }));

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,44rem)] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 max-lg:h-[min(92dvh,44rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
            <ResponsiveModalTitle>Edit this post</ResponsiveModalTitle>
            <p className="text-muted-foreground text-xs">Free. No credits used.</p>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <section className="space-y-3" aria-label="Text">
              {QUICK_EDIT_TEXT_SLOTS.map((slot) => {
                const invalid = tooLong.includes(slot.key);
                return (
                  <div key={slot.key} className="space-y-1.5">
                    <label htmlFor={`qe-${slot.key}`} className="settings-field-label">
                      {slot.label}
                    </label>
                    <Input
                      id={`qe-${slot.key}`}
                      value={text[slot.key]}
                      maxLength={quickEditCharLimit(slot.key) * 2}
                      error={invalid}
                      aria-invalid={invalid}
                      onChange={(event) =>
                        setText((current) => ({ ...current, [slot.key]: event.target.value }))
                      }
                    />
                    {invalid ? (
                      <p className="text-destructive text-xs">Too long for this layout.</p>
                    ) : null}
                  </div>
                );
              })}
            </section>

            {libraryPhotos.length > 0 ? (
              <section className="space-y-2" aria-label="Photo">
                <p className="settings-field-label">Photo</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {libraryPhotos.slice(0, 24).map((url) => {
                    const on = url === hero;
                    return (
                      <button
                        key={url}
                        type="button"
                        aria-pressed={on}
                        aria-label={on ? 'Current photo' : 'Use this photo'}
                        onClick={() =>
                          setDraft((current) => setHeroPhoto(current.spec, current.photoUrls, url))
                        }
                        className={cn(
                          'focus-visible:ring-ring relative size-16 shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2',
                          on && 'ring-primary-strong ring-2'
                        )}
                      >
                        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                        {on ? (
                          <span className="bg-primary-strong text-primary-foreground absolute right-1 top-1 flex size-5 items-center justify-center rounded-full">
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="space-y-2" aria-label="Layout">
              <p className="settings-field-label">Layout</p>
              <div className="flex flex-wrap gap-2">
                {layoutChoices(draft.spec.archetype).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={id === draft.spec.archetype}
                    onClick={() => patch(setPosterLayout(draft.spec, id, { keepFonts }))}
                    className={cn(
                      'border-border focus-visible:ring-ring min-h-[44px] rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 lg:min-h-9',
                      id === draft.spec.archetype && 'border-primary-strong bg-primary-strong/10'
                    )}
                  >
                    {layoutName(id)}
                    <span className="text-muted-foreground ml-1 font-normal">
                      {POSTER_FAMILY_LABEL[POSTER_ARCHETYPE_FAMILY[id]]}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-1" aria-label="Show">
              <p className="settings-field-label">Show</p>
              {TOGGLES.map((toggle) => (
                <label
                  key={toggle.key}
                  className={cn(
                    'flex min-h-[44px] items-center justify-between gap-3 text-sm',
                    !available[toggle.key] && 'text-muted-foreground'
                  )}
                >
                  {toggle.label}
                  <Switch
                    checked={draft.spec.include[toggle.key]}
                    disabled={!available[toggle.key]}
                    onCheckedChange={(on) =>
                      patch(setPosterToggle(draft.spec, toggle.key, on, available))
                    }
                  />
                </label>
              ))}
            </section>
          </div>

          <div className="border-border flex shrink-0 gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] flex-1"
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] flex-1"
              disabled={!dirty || saving || tooLong.length > 0}
              onClick={() => void apply().then((done) => done && onOpenChange(false))}
            >
              {saving ? 'Saving' : 'Apply'}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
