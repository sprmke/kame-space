import { useEffect, useState, type ReactNode } from 'react';

import { HardDriveDownload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getPwaCapabilities, requestPersistentStorage } from '@/lib/pwa/capabilities';
import { purgeOfflineState } from '@/lib/pwa/purgeOfflineState';
import { checkForPwaUpdate } from '@/lib/pwa/useRegisterSW';
import { cn } from '@/lib/utils';

type AppInfoCardProps = {
  className?: string;
  /** `card` = bordered block. `embedded` = no chrome (profile modal / sheets). */
  variant?: 'card' | 'embedded';
};

type StorageState = {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
};

const actionButtonClassName = 'h-11 w-full justify-start gap-2 px-3 sm:h-10';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Human label for `VITE_APP_VERSION` (avoids raw "local" / empty). */
function formatAppVersion(version: string | undefined): string {
  const trimmed = version?.trim();
  if (!trimmed) return 'Unknown';
  if (trimmed === 'local' || trimmed === 'dev') return 'Local build';
  return trimmed;
}

function storageUsageLabel(state: StorageState): string {
  if (state.usage === null) return 'Not available';
  return `${formatBytes(state.usage)} used`;
}

/** Shared fact block: muted label, value, then optional actions below. */
function DeviceFact({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm">{value}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Offline storage: usage, optional persist request, and clear (PWA v2 tasks 5.14 / 4.8 / 2.2).
 * Install lives on More / marketing (`InstallAppEntry`), not here.
 */
function OfflineDataPanel() {
  const [state, setState] = useState<StorageState>({ usage: null, quota: null, persisted: null });
  const [clearing, setClearing] = useState(false);
  const caps = getPwaCapabilities();
  const showKeep = state.persisted === false && caps.persistentStorage;
  const value =
    state.persisted === true ? `${storageUsageLabel(state)} · kept` : storageUsageLabel(state);

  useEffect(() => {
    if (!caps.storageEstimate) return;
    let active = true;
    void (async () => {
      try {
        const estimate = await navigator.storage.estimate();
        const persisted = (await navigator.storage.persisted?.()) ?? null;
        if (active) {
          setState({
            usage: estimate.usage ?? null,
            quota: estimate.quota ?? null,
            persisted,
          });
        }
      } catch {
        // storage API blocked — the panel just omits the numbers
      }
    })();
    return () => {
      active = false;
    };
  }, [caps.storageEstimate]);

  return (
    <DeviceFact label="Offline" value={value}>
      <div className="flex flex-row gap-2">
        {showKeep ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(actionButtonClassName, 'min-w-0 flex-1')}
            onClick={() => {
              void requestPersistentStorage().then((ok) => {
                setState((prev) => ({ ...prev, persisted: ok }));
                if (ok) toast.success('Saved data will be kept');
              });
            }}
          >
            <HardDriveDownload className="size-3.5 shrink-0" aria-hidden />
            Keep data
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(actionButtonClassName, 'min-w-0 flex-1')}
          disabled={clearing}
          onClick={() => {
            setClearing(true);
            void purgeOfflineState()
              .then(() => {
                toast.success('Saved data cleared');
                setState((prev) => ({ ...prev, usage: 0 }));
              })
              .finally(() => setClearing(false));
          }}
        >
          {clearing ? 'Clearing…' : 'Clear saved data'}
        </Button>
      </div>
    </DeviceFact>
  );
}

/**
 * Quiet device controls: build id, check for updates, offline clear.
 * One left column: label → value → full-width left-aligned actions.
 * Install stays on More / marketing via `InstallAppEntry`.
 */
export function AppInfoCard({ className, variant = 'card' }: AppInfoCardProps) {
  const version = formatAppVersion(import.meta.env.VITE_APP_VERSION);

  return (
    <div
      className={cn(
        'space-y-4',
        variant === 'card' && 'border-border bg-card rounded-xl border p-4',
        variant === 'embedded' && 'border-border/70 border-t pt-4',
        className
      )}
    >
      <p className="text-foreground text-sm font-semibold">On this device</p>

      <DeviceFact label="Version" value={version}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={actionButtonClassName}
          onClick={() => {
            checkForPwaUpdate();
          }}
        >
          <RefreshCw className="size-3.5 shrink-0" aria-hidden />
          Check updates
        </Button>
      </DeviceFact>

      <div className="border-border/70 border-t pt-4">
        <OfflineDataPanel />
      </div>
    </div>
  );
}
