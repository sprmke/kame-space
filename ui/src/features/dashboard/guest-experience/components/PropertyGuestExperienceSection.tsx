import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  GUEST_ESSENTIALS_QUERY_KEY,
  useGuestEssentialsQuery,
} from '@/features/dashboard/guest-experience/hooks/useGuestEssentials';
import {
  EMPTY_GUEST_ESSENTIALS,
  saveGuestEssentials,
  type GuestEssentialsDraft,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsApi';
import {
  changedEssentialsFields,
  ESSENTIALS_GROUPS,
  guestEssentialsEqual,
  summarizeGuestEssentials,
  type EssentialsFieldKey,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsFields';
import {
  SettingsField,
  SettingsManageButton,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

/** Secret field with a reveal toggle. Masked by default: a host may be screen-sharing. */
function SecretInput({
  id,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="pr-12"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 size-10 -translate-y-1/2"
        aria-label={visible ? `Hide ${id}` : `Show ${id}`}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}

function GuestEssentialsSummary({
  draft,
  listingUnitLabel,
  disabled,
  onManage,
}: {
  draft: GuestEssentialsDraft;
  listingUnitLabel?: string | null;
  disabled?: boolean;
  onManage: () => void;
}) {
  const { chips, empty, needsAttention } = summarizeGuestEssentials(draft, listingUnitLabel);
  const line = empty ? 'No arrival essentials yet' : chips.slice(0, 4).join(' · ');
  const extra = !empty && chips.length > 4 ? chips.length - 4 : 0;

  return (
    <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-xs font-medium sm:text-sm',
          empty ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {line}
        {extra > 0 ? (
          <span className="bg-muted text-muted-foreground ml-1 inline-flex items-center rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold tabular-nums">
            +{extra}
          </span>
        ) : null}
      </p>
      <SettingsManageButton
        disabled={disabled}
        needsAttention={needsAttention}
        onClick={onManage}
      />
    </div>
  );
}

/**
 * Property Settings → Guest experience.
 *
 * Card: compact essentials summary + Manage (same pattern as Payment / Guest Form).
 * Check-in and check-out steps stay on Templates. Quiet hours stay on House rules.
 * Listing unit from Basic Info is read-only when present.
 */
export function PropertyGuestExperienceSection({
  propertyId,
  orgSlug,
  propertySlug,
  listingUnitLabel,
  disabled = false,
}: {
  propertyId: string;
  orgSlug?: string;
  propertySlug?: string;
  listingUnitLabel?: string | null;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: access } = usePropertyPermissions();
  const canEdit = hasPropertyPermission(access?.permissions, 'templates.standard:edit');

  const essentialsQuery = useGuestEssentialsQuery();
  const listingUnit = listingUnitLabel?.trim() || '';
  const unitFromListing = listingUnit.length > 0;

  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<GuestEssentialsDraft>(EMPTY_GUEST_ESSENTIALS);
  const [baseline, setBaseline] = useState<GuestEssentialsDraft>(EMPTY_GUEST_ESSENTIALS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!essentialsQuery.data) return;
    setDraft(essentialsQuery.data);
    setBaseline(essentialsQuery.data);
  }, [essentialsQuery.data]);

  const isDirty = useMemo(() => !guestEssentialsEqual(baseline, draft), [baseline, draft]);
  const isLoading = essentialsQuery.isPending;
  const fieldsDisabled = disabled || !canEdit || isLoading || saving;

  const openManage = () => {
    if (essentialsQuery.data) {
      setDraft(essentialsQuery.data);
      setBaseline(essentialsQuery.data);
    }
    setManageOpen(true);
  };

  const closeManageClean = () => {
    setManageOpen(false);
    if (essentialsQuery.data) {
      setDraft(essentialsQuery.data);
      setBaseline(essentialsQuery.data);
    }
    setSaving(false);
  };

  async function save(): Promise<boolean> {
    if (!canEdit || !isDirty || saving) return !isDirty;
    setSaving(true);
    try {
      const nextDraft =
        unitFromListing && !draft.unitFloor.trim() ? { ...draft, unitFloor: listingUnit } : draft;
      const changed = changedEssentialsFields(baseline, nextDraft).filter(
        (key) => key !== 'quietHours'
      );
      const saved = await saveGuestEssentials(propertyId, nextDraft, changed);
      setDraft(saved);
      setBaseline(saved);
      queryClient.setQueryData(GUEST_ESSENTIALS_QUERY_KEY(propertyId), saved);
      toast.success('Saved');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open: manageOpen,
    onOpenChange: (next) => {
      if (next) openManage();
      else closeManageClean();
    },
    isDirty,
    onSave: async () => {
      const ok = await save();
      if (ok) closeManageClean();
      return ok;
    },
    onDiscard: () => {
      setDraft(baseline);
    },
  });

  function setField(key: EssentialsFieldKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const templatesHref =
    orgSlug && propertySlug ? propertySectionPath(orgSlug, propertySlug, 'templates') : null;

  const summaryDraft = essentialsQuery.data ?? draft;

  return (
    <div className="space-y-3">
      <GuestEssentialsSummary
        draft={summaryDraft}
        listingUnitLabel={listingUnit}
        disabled={disabled || !canEdit}
        onManage={openManage}
      />

      {templatesHref ? (
        <p className="text-muted-foreground text-xs sm:text-sm">
          Check-in and check-out steps are edited in{' '}
          <Link
            to={templatesHref}
            className="text-foreground font-medium underline-offset-2 hover:underline"
          >
            Templates
          </Link>
          . Quiet hours live in House rules.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs sm:text-sm">
          Check-in and check-out steps are edited in Templates. Quiet hours live in House rules.
        </p>
      )}

      {essentialsQuery.isError ? (
        <p className="text-destructive text-sm">Could not load these settings.</p>
      ) : null}

      <ResponsiveModal open={manageOpen} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-3">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Guest experience
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {ESSENTIALS_GROUPS.map((group) => (
              <div key={group.id} className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  {group.title}
                </h3>
                {group.fields.map((field) => {
                  if (field.key === 'unitFloor' && unitFromListing) {
                    return (
                      <SettingsField
                        key={field.key}
                        id="guest-essentials-listing-unit"
                        label="Unit and floor"
                        help="From Basic Info. Guests see this on their trip."
                      >
                        <Input
                          id="guest-essentials-listing-unit"
                          value={listingUnit}
                          disabled
                          readOnly
                        />
                      </SettingsField>
                    );
                  }

                  const id = `guest-essentials-${field.key}`;
                  const value = draft[field.key];
                  return (
                    <SettingsField
                      key={field.key}
                      id={id}
                      label={field.label}
                      help={field.secret ? 'Hidden from guests until the reveal time.' : undefined}
                    >
                      {field.secret ? (
                        <SecretInput
                          id={id}
                          value={value}
                          placeholder={field.placeholder}
                          disabled={fieldsDisabled}
                          onChange={(next) => setField(field.key, next)}
                        />
                      ) : (
                        <Input
                          id={id}
                          type={field.phone ? 'tel' : 'text'}
                          value={value}
                          placeholder={field.placeholder}
                          disabled={fieldsDisabled}
                          onChange={(event) => setField(field.key, event.target.value)}
                        />
                      )}
                    </SettingsField>
                  );
                })}
              </div>
            ))}

            <SettingsField
              id="guest-essentials-reveal"
              label="Reveal codes before check-in"
              help="Hours before check-in that guests can see the Wi-Fi password and door code."
            >
              <Input
                id="guest-essentials-reveal"
                type="number"
                min={0}
                max={720}
                step={1}
                inputMode="numeric"
                value={String(draft.revealLeadHours)}
                disabled={fieldsDisabled}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setDraft((current) => ({
                    ...current,
                    revealLeadHours: Number.isFinite(next) ? Math.min(Math.max(next, 0), 720) : 0,
                  }));
                }}
                className="max-w-[8rem]"
              />
            </SettingsField>

            <p className="text-muted-foreground text-xs">
              Quiet hours are set in House rules on this page.
            </p>
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
              disabled={fieldsDisabled || !isDirty}
              onClick={() => {
                void (async () => {
                  const ok = await save();
                  if (ok) closeManageClean();
                })();
              }}
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </div>
  );
}
