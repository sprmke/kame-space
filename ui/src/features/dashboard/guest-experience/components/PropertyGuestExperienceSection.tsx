import { useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { GuestExperienceReadinessCard } from '@/features/dashboard/guest-experience/components/GuestExperienceReadinessCard';
import { GUEST_ESSENTIALS_QUERY_KEY, useGuestEssentialsQuery } from '@/features/dashboard/guest-experience/hooks/useGuestEssentials';
import {
  EMPTY_GUEST_ESSENTIALS,
  saveGuestEssentials,
  type GuestEssentialsDraft,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsApi';
import {
  changedEssentialsFields,
  ESSENTIALS_GROUPS,
  guestEssentialsEqual,
  type EssentialsFieldKey,
} from '@/features/dashboard/guest-experience/lib/guestEssentialsFields';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/** Secret field with a reveal toggle. Masked by default: a host may be screen-sharing. */
function SecretInput({
  id,
  value,
  placeholder,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
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
        onBlur={onBlur}
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
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </Button>
    </div>
  );
}

/**
 * Property Settings -> Guest experience (guest journey plan D7 / task 7.3).
 *
 * These fields are what the guest sees on their trip page and in the stay guide. The Wi-Fi
 * password and door code are withheld from the guest until the reveal time, so a host can
 * fill them in early without handing the code out.
 */
export function PropertyGuestExperienceSection({
  propertyId,
  disabled = false,
}: {
  propertyId: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: access } = usePropertyPermissions();
  const canEdit = hasPropertyPermission(access?.permissions, 'templates.standard:edit');

  const essentialsQuery = useGuestEssentialsQuery();

  const [draft, setDraft] = useState<GuestEssentialsDraft>(EMPTY_GUEST_ESSENTIALS);
  const [baseline, setBaseline] = useState<GuestEssentialsDraft>(EMPTY_GUEST_ESSENTIALS);
  const [saving, setSaving] = useState(false);

  // Seed the form once the server answers. A refetch after a save resets both, which is
  // correct: the saved values are the new baseline.
  useEffect(() => {
    if (!essentialsQuery.data) return;
    setDraft(essentialsQuery.data);
    setBaseline(essentialsQuery.data);
  }, [essentialsQuery.data]);

  const isDirty = useMemo(() => !guestEssentialsEqual(baseline, draft), [baseline, draft]);
  const isLoading = essentialsQuery.isPending;

  async function save() {
    if (!canEdit || !isDirty || saving) return;
    setSaving(true);
    try {
      const changed = changedEssentialsFields(baseline, draft);
      const saved = await saveGuestEssentials(propertyId, draft, changed);
      setDraft(saved);
      setBaseline(saved);
      queryClient.setQueryData(GUEST_ESSENTIALS_QUERY_KEY(propertyId), saved);
      toast.success('Saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  useUnsavedChangesGuard({ isDirty, onSave: save });

  function setField(key: EssentialsFieldKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <GuestExperienceReadinessCard />

      {ESSENTIALS_GROUPS.map((group) => (
        <div key={group.id} className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            {group.title}
          </h3>
          {group.fields.map((field) => {
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
                    disabled={disabled || !canEdit || isLoading}
                    onChange={(next) => setField(field.key, next)}
                    onBlur={() => undefined}
                  />
                ) : (
                  <Input
                    id={id}
                    type={field.phone ? 'tel' : 'text'}
                    value={value}
                    placeholder={field.placeholder}
                    disabled={disabled || !canEdit || isLoading}
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
          disabled={disabled || !canEdit || isLoading}
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

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={disabled || !canEdit || !isDirty || saving}
          className="min-h-[44px]"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save
        </Button>
        {essentialsQuery.isError ? (
          <p className="text-destructive text-sm">Could not load these settings.</p>
        ) : null}
      </div>
    </div>
  );
}
