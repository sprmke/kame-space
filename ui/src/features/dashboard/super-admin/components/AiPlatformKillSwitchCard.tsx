import { useEffect, useState } from 'react';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiPlatformGlobalSettings,
  useUpdateAiPlatformGlobalSettings,
} from '@/features/dashboard/super-admin/hooks/useAiPlatformGlobalSettings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

/** UI toggles — each row maps to one or more `AiFeature` ids from the server allowlist. */
const AI_FEATURE_TOGGLES = [
  { ids: ['receipt_validation'], label: 'Receipt validation' },
  { ids: ['inbox_suggest'], label: 'Inbox suggestions' },
  { ids: ['inbox_auto_reply'], label: 'Inbox auto-reply' },
  { ids: ['marketing_caption'], label: 'Marketing captions' },
  { ids: ['marketing_template'], label: 'Marketing templates' },
  { ids: ['marketing_image_generate'], label: 'Marketing image generation' },
  { ids: ['marketing_video_generate'], label: 'Marketing video generation' },
  { ids: ['import_column_map'], label: 'Import column mapping' },
  { ids: ['voice_polish'], label: 'Voice polish' },
  { ids: ['ai_integration_verify'], label: 'Integration verify' },
  {
    ids: ['booking_ai_summary_guests', 'booking_ai_summary_pets', 'booking_ai_summary_pricing'],
    label: 'Booking AI review',
  },
  { ids: ['voice_receptionist'], label: 'Voice receptionist' },
  { ids: ['dashboard_assistant'], label: 'Dashboard assistant' },
] as const;

const ALL_FEATURE_IDS = AI_FEATURE_TOGGLES.flatMap((toggle) => [...toggle.ids]);

const CARD_CLASS = 'border-border bg-card flex h-full min-w-0 flex-col gap-5 rounded-xl border p-5';

type NumberSettingFieldProps = {
  id: string;
  label: string;
  value: number | null | undefined;
  min: number;
  max?: number;
  step?: number | 'any';
  integer?: boolean;
  disabled?: boolean;
  onCommit: (value: number) => void;
};

/**
 * Numbers commit when the operator leaves the field. Saving on every keystroke sent 1, then 10,
 * then 100 for a single edit. Invalid input reverts and explains the range.
 */
function NumberSettingField({
  id,
  label,
  value,
  min,
  max,
  step,
  integer = false,
  disabled,
  onCommit,
}: NumberSettingFieldProps) {
  const asText = (next: number | null | undefined) => (next == null ? '' : String(next));
  const [draft, setDraft] = useState(asText(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(asText(value));
    setError(null);
  }, [value]);

  const commit = () => {
    const parsed = integer ? Number.parseInt(draft, 10) : Number.parseFloat(draft);
    const inRange =
      Number.isFinite(parsed) &&
      (integer ? Number.isInteger(parsed) : true) &&
      parsed >= min &&
      (max === undefined || parsed <= max);
    if (!inRange) {
      setError(max !== undefined ? `Enter ${min} to ${max}.` : `Enter ${min} or more.`);
      setDraft(asText(value));
      return;
    }
    setError(null);
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span>{label}</span>
      <Input
        id={id}
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        step={step}
        className="h-10"
        value={draft}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function AiPlatformKillSwitchCard() {
  const { data, isLoading } = useAiPlatformGlobalSettings();
  const update = useUpdateAiPlatformGlobalSettings();
  const [voiceAllowlistDraft, setVoiceAllowlistDraft] = useState('');

  useEffect(() => {
    setVoiceAllowlistDraft((data?.voiceReceptionistRolloutPropertyIds ?? []).join('\n'));
  }, [data?.voiceReceptionistRolloutPropertyIds]);

  const allowed = new Set(data?.allowedFeatures ?? []);
  const allEnabled = Boolean(data?.enabled) && allowed.size === 0;
  const controlsDisabled = isLoading || update.isPending;
  const featuresDisabled = controlsDisabled || !data?.enabled;

  const save = (patch: {
    enabled?: boolean;
    enforceQuotas?: boolean;
    allowedFeatures?: string[];
    defaultDailyCallLimit?: number;
    defaultMonthlyCallLimit?: number;
    defaultDailyCostUsdLimit?: number;
    creditUnitUsd?: number;
    voiceReceptionistCostPerMinuteUsd?: number;
    voiceReceptionistRolloutPercentage?: number;
    voiceReceptionistRolloutPropertyIds?: string[];
    voiceReceptionistTranscriptRetentionDays?: number;
  }) => {
    update.mutate(patch, {
      onSuccess: () => toast.success('AI platform settings updated'),
      onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not save setting')),
    });
  };

  const saveVoiceAllowlist = async (): Promise<boolean> => {
    const ids = Array.from(
      new Set(
        voiceAllowlistDraft
          .split(/[\s,]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    if (
      ids.some(
        (id) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      )
    ) {
      toast.error('Enter valid property IDs');
      return false;
    }
    try {
      await update.mutateAsync({ voiceReceptionistRolloutPropertyIds: ids });
      toast.success('AI platform settings updated');
      return true;
    } catch (err: unknown) {
      toast.error(friendlyToastError(err, 'Could not save setting'));
      return false;
    }
  };

  useUnsavedChangesGuard({
    isDirty: voiceAllowlistDraft !== (data?.voiceReceptionistRolloutPropertyIds ?? []).join('\n'),
    onSave: saveVoiceAllowlist,
  });

  const handleEnabledChange = (enabled: boolean) => {
    save({ enabled });
  };

  const handleQuotaChange = (enforceQuotas: boolean) => {
    save({ enforceQuotas });
  };

  const handleFeatureChange = (featureIds: readonly string[], checked: boolean) => {
    // Empty allowlist = all features allowed. Converting to an explicit list starts from every known id.
    const next = new Set(allowed.size === 0 ? ALL_FEATURE_IDS : allowed);
    for (const id of featureIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }

    // Collapse back to empty (= all allowed) when every known feature is selected.
    const nextList =
      ALL_FEATURE_IDS.every((id) => next.has(id)) && next.size >= ALL_FEATURE_IDS.length
        ? []
        : Array.from(next);
    save({ allowedFeatures: nextList });
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-start gap-3">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="text-muted-foreground size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium">Platform AI</p>
          <p className="text-muted-foreground text-xs">Shared Gemini/Groq features</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
          <span>Enabled</span>
          <Switch
            checked={Boolean(data?.enabled)}
            disabled={controlsDisabled}
            onCheckedChange={handleEnabledChange}
            aria-label="Enable platform AI"
          />
        </label>
        <label className="flex min-h-[44px] items-center justify-between gap-3 text-sm">
          <span>Enforce quotas</span>
          <Switch
            checked={data?.enforceQuotas !== false}
            disabled={featuresDisabled}
            onCheckedChange={handleQuotaChange}
            aria-label="Enforce org AI quotas"
          />
        </label>
      </div>

      <div className="border-border/50 bg-muted/15 rounded-lg border px-3 py-2.5 text-sm">
        <div className="flex min-h-[24px] items-center justify-between gap-3">
          <span className="font-medium">Voice health</span>
          <span
            className={
              data?.voiceReceptionistHealthStatus === 'healthy'
                ? 'text-success'
                : data?.voiceReceptionistHealthStatus === 'unhealthy'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }
          >
            {data?.voiceReceptionistHealthStatus ?? 'unknown'}
          </span>
        </div>
        {data?.voiceReceptionistHealthCheckedAt ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {data.voiceReceptionistHealthModel ?? 'Model unknown'} ·{' '}
            {data.voiceReceptionistHealthProtocolVersion ?? 'Protocol unknown'} · mint{' '}
            {data.voiceReceptionistHealthTokenMintMs ?? 0} ms · setup{' '}
            {data.voiceReceptionistHealthSetupMs ?? 0} ms
          </p>
        ) : null}
      </div>
      {data?.voiceReceptionistMetrics ? (
        <div className="border-border/50 bg-muted/15 rounded-lg border px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Voice reliability</span>
            <span className="text-muted-foreground">
              {data.voiceReceptionistMetrics.sessions} sessions
            </span>
          </div>
          <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <span>Startup p95 {data.voiceReceptionistMetrics.startupMs.p95 ?? 'n/a'} ms</span>
            <span>
              First audio p95 {data.voiceReceptionistMetrics.firstAudioMs.p95 ?? 'n/a'} ms
            </span>
            <span>Tool p95 {data.voiceReceptionistMetrics.toolMs.p95 ?? 'n/a'} ms</span>
            <span>Session p95 {data.voiceReceptionistMetrics.sessionSeconds.p95 ?? 'n/a'} sec</span>
            <span>Reconnect p95 {data.voiceReceptionistMetrics.reconnects.p95 ?? 'n/a'}</span>
            <span>Completion {data.voiceReceptionistMetrics.completionRatePct ?? 'n/a'}%</span>
          </div>
          {Object.values(data.voiceReceptionistMetrics.alerts).some(Boolean) ? (
            <p role="alert" className="text-destructive mt-2 text-xs">
              Voice reliability threshold exceeded.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Allowed features</p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
          {AI_FEATURE_TOGGLES.map((feature) => {
            const checked = allEnabled || feature.ids.every((id) => allowed.has(id));
            return (
              <label
                key={feature.label}
                className="flex min-h-[44px] items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0">{feature.label}</span>
                <Switch
                  checked={checked}
                  disabled={featuresDisabled}
                  onCheckedChange={(value) => handleFeatureChange(feature.ids, value)}
                  aria-label={`Allow ${feature.label}`}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberSettingField
          id="ai-daily-calls"
          label="Daily calls"
          value={data?.defaultDailyCallLimit}
          min={1}
          integer
          disabled={featuresDisabled}
          onCommit={(value) => save({ defaultDailyCallLimit: value })}
        />
        <NumberSettingField
          id="ai-monthly-calls"
          label="Monthly calls"
          value={data?.defaultMonthlyCallLimit}
          min={1}
          integer
          disabled={featuresDisabled}
          onCommit={(value) => save({ defaultMonthlyCallLimit: value })}
        />
        <NumberSettingField
          id="ai-daily-cost"
          label="Daily cost USD"
          value={data?.defaultDailyCostUsdLimit}
          min={0.01}
          step={0.01}
          disabled={featuresDisabled}
          onCommit={(value) => save({ defaultDailyCostUsdLimit: value })}
        />
        <NumberSettingField
          id="ai-credit-unit"
          label="Credit unit (USD)"
          value={data?.creditUnitUsd}
          min={0.0001}
          step={0.0001}
          disabled={featuresDisabled}
          onCommit={(value) => save({ creditUnitUsd: value })}
        />
        <NumberSettingField
          id="ai-voice-cost"
          label="Voice cost/min (USD)"
          value={data?.voiceReceptionistCostPerMinuteUsd}
          min={0.0001}
          step={0.0001}
          disabled={featuresDisabled}
          onCommit={(value) => save({ voiceReceptionistCostPerMinuteUsd: value })}
        />
        <NumberSettingField
          id="ai-voice-rollout"
          label="Voice rollout (%)"
          value={data?.voiceReceptionistRolloutPercentage}
          min={0}
          max={100}
          integer
          disabled={featuresDisabled}
          onCommit={(value) => save({ voiceReceptionistRolloutPercentage: value })}
        />
        <NumberSettingField
          id="ai-voice-retention"
          label="Voice retention (days)"
          value={data?.voiceReceptionistTranscriptRetentionDays}
          min={1}
          max={90}
          integer
          disabled={featuresDisabled}
          onCommit={(value) => save({ voiceReceptionistTranscriptRetentionDays: value })}
        />
      </div>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm">
        <span>Voice property allowlist</span>
        <Textarea
          rows={3}
          value={voiceAllowlistDraft}
          disabled={featuresDisabled}
          onChange={(event) => setVoiceAllowlistDraft(event.target.value)}
          placeholder="One property ID per line"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={featuresDisabled}
        onClick={() => void saveVoiceAllowlist()}
        className="min-h-[44px] self-start"
      >
        Save allowlist
      </Button>
    </div>
  );
}
