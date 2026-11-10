import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useInboxConnections } from '@/features/dashboard/inbox/hooks/useInbox';
import { useOrgSlugParam, useResolvedOrgId, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const GOALS = [
  { id: 'fill_open_nights', label: 'Fill open nights' },
  { id: 'weekends', label: 'Weekends and long weekends' },
  { id: 'direct_bookings', label: 'More direct bookings' },
  { id: 'longer_stays', label: 'Longer stays' },
  { id: 'brand', label: 'Get known' },
] as const;

const MANUAL_PLACES = [
  { kind: 'facebook_group', label: 'Facebook groups', hint: 'Groups you already post in' },
  { kind: 'tiktok', label: 'TikTok', hint: null },
  { kind: 'messenger', label: 'Messenger', hint: null },
  { kind: 'viber', label: 'Viber', hint: null },
  { kind: 'whatsapp', label: 'WhatsApp', hint: null },
  { kind: 'google_business', label: 'Google Business', hint: null },
  { kind: 'other', label: 'Other', hint: null },
] as const;

const CADENCE = [
  { id: 'light', label: 'Light', hint: 'About 30 minutes a week' },
  { id: 'steady', label: 'Steady', hint: '1 to 2 hours' },
  { id: 'active', label: 'Active', hint: 'About 3 hours' },
] as const;

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'fil', label: 'Filipino' },
  { id: 'taglish', label: 'Taglish' },
] as const;

type ManualKind =
  | 'facebook_group'
  | 'tiktok'
  | 'messenger'
  | 'viber'
  | 'whatsapp'
  | 'google_business'
  | 'other';

type PlannerChannel =
  | { kind: 'facebook_page' | 'instagram'; connectionId: string }
  | { kind: ManualKind; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaving?: boolean;
  initial?: {
    goals: string[];
    cadencePreset: string;
    channels: unknown[];
    language: string;
  } | null;
  onSave: (patch: Record<string, unknown>) => Promise<boolean> | boolean;
};

function splitChannels(channels: unknown[]): {
  connected: string[];
  manual: string[];
} {
  const connected: string[] = [];
  const manual: string[] = [];
  for (const entry of channels) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    if (row.kind === 'facebook_page' || row.kind === 'instagram') {
      if (typeof row.connectionId === 'string' && row.connectionId) connected.push(row.connectionId);
      continue;
    }
    if (typeof row.kind === 'string') manual.push(row.kind);
  }
  return { connected, manual };
}

export function PlannerSetupWizard({ open, onOpenChange, isSaving, initial, onSave }: Props) {
  const propertyId = usePropertyIdParam();
  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();
  const connections = useInboxConnections(orgSlug, orgId, { propertyId });

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>(initial?.goals ?? []);
  const [cadence, setCadence] = useState<string>(initial?.cadencePreset ?? 'steady');
  const [language, setLanguage] = useState<string>(initial?.language ?? 'en');
  const [connected, setConnected] = useState<string[]>([]);
  const [manual, setManual] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const split = splitChannels(initial?.channels ?? []);
    setConnected(split.connected);
    setManual(split.manual);
  }, [open, initial]);

  const connectedOptions = useMemo(
    () =>
      (connections.data?.connections ?? [])
        .filter((connection) => connection.platform === 'facebook' || connection.platform === 'instagram')
        .map((connection) => ({
          id: connection.id,
          kind: (connection.platform === 'facebook' ? 'facebook_page' : 'instagram') as
            | 'facebook_page'
            | 'instagram',
          label: connection.displayName ?? (connection.platform === 'facebook' ? 'Facebook Page' : 'Instagram'),
        })),
    [connections.data]
  );

  const dirty =
    goals.length > 0 &&
    (goals.join(',') !== (initial?.goals ?? []).join(',') ||
      cadence !== (initial?.cadencePreset ?? 'steady') ||
      language !== (initial?.language ?? 'en') ||
      connected.join(',') !== splitChannels(initial?.channels ?? []).connected.join(',') ||
      manual.join(',') !== splitChannels(initial?.channels ?? []).manual.join(','));

  const buildChannels = (): PlannerChannel[] => {
    const channels: PlannerChannel[] = [];
    for (const id of connected) {
      const option = connectedOptions.find((entry) => entry.id === id);
      if (option) channels.push({ kind: option.kind, connectionId: option.id });
    }
    for (const kind of manual) {
      const place = MANUAL_PLACES.find((entry) => entry.kind === kind);
      if (!place) continue;
      channels.push({ kind: place.kind, label: place.label });
    }
    return channels;
  };

  const save = async (): Promise<boolean> => {
    const patch: Record<string, unknown> = {
      goals,
      cadencePreset: cadence,
      language,
      channels: buildChannels(),
    };
    return onSave(patch);
  };

  const guard = useGuardedClose({
    open,
    onOpenChange,
    isDirty: dirty,
    onSave: async () => ((await save()) ? true : false),
  });

  const toggle = (list: string[], value: string, max?: number): string[] => {
    if (list.includes(value)) return list.filter((entry) => entry !== value);
    if (max && list.length >= max) return [...list.slice(1), value];
    return [...list, value];
  };

  const canContinue = step === 0 ? goals.length > 0 : true;

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guard.onOpenChange}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {step === 0
                ? 'What matters most right now?'
                : step === 1
                  ? 'Where do you post?'
                  : 'How much time do you have?'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          {step === 0 ? (
            <div className="space-y-3">
              <p className="text-caption text-muted-foreground">Pick up to two.</p>
              {GOALS.map((goal) => (
                <label key={goal.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={goals.includes(goal.id)}
                    onCheckedChange={() => setGoals((current) => toggle(current, goal.id, 2))}
                    aria-label={goal.label}
                  />
                  {goal.label}
                </label>
              ))}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Connected</p>
                {connectedOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Facebook Page or Instagram connected. You can still post by hand.
                  </p>
                ) : (
                  connectedOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={connected.includes(option.id)}
                        onCheckedChange={() =>
                          setConnected((current) => toggle(current, option.id))
                        }
                        aria-label={option.label}
                      />
                      {option.label}
                    </label>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Places you post by hand</p>
                {MANUAL_PLACES.map((place) => (
                  <label key={place.kind} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={manual.includes(place.kind)}
                      onCheckedChange={() => setManual((current) => toggle(current, place.kind))}
                      aria-label={place.label}
                    />
                    <span>
                      {place.label}
                      {place.hint ? (
                        <span className="text-caption text-muted-foreground"> {place.hint}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Time each week</p>
                {CADENCE.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="planner-cadence"
                      checked={cadence === option.id}
                      onChange={() => setCadence(option.id)}
                    />
                    <span>
                      {option.label}
                      <span className="text-caption text-muted-foreground"> {option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Language</p>
                {LANGUAGES.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="planner-language"
                      checked={language === option.id}
                      onChange={() => setLanguage(option.id)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <ResponsiveModalFooter className="flex flex-wrap justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => (step === 0 ? guard.requestClose() : setStep(step - 1))}
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 2 ? (
              <Button size="sm" disabled={!canContinue} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isSaving || goals.length === 0}
                onClick={async () => {
                  if (await save()) guard.onOpenChange(false);
                }}
              >
                {isSaving ? 'Saving' : 'Save'}
              </Button>
            )}
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...guard.dialogProps} />
    </>
  );
}
