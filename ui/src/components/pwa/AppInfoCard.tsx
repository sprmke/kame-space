import { useEffect, useState, type ReactNode } from 'react';

import { HardDriveDownload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { getPwaCapabilities, requestPersistentStorage } from '@/lib/pwa/capabilities';
import { formatAppVersionLabel } from '@/lib/pwa/formatAppVersion';
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

const actionButtonClassName = 'h-10 w-full justify-center gap-2 px-3 sm:h-9';

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

function storageUsageLabel(state: StorageState): string {
  if (state.usage === null) return 'Not available';
  const base = `${formatBytes(state.usage)} offline`;
  return state.persisted === true ? `${base} · kept` : base;
}

/** One column: muted label, value, then actions. */
function AppFact({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="space-y-0.5">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-foreground text-sm tabular-nums">{value}</p>
      </div>
      {children ? <div className="mt-auto flex flex-col gap-2">{children}</div> : null}
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
    <AppFact label="Offline copy" value={storageUsageLabel(state)}>
      {showKeep ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={actionButtonClassName}
          onClick={() => {
            void requestPersistentStorage().then((ok) => {
              setState((prev) => ({ ...prev, persisted: ok }));
              if (ok) toast.success('Offline copy will be kept');
            });
          }}
        >
          <HardDriveDownload className="size-3.5 shrink-0" aria-hidden />
          Keep offline copy
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={actionButtonClassName}
        disabled={clearing}
        onClick={() => {
          setClearing(true);
          void purgeOfflineState()
            .then(() => {
              toast.success('Offline copy cleared');
              setState((prev) => ({ ...prev, usage: 0 }));
            })
            .finally(() => setClearing(false));
        }}
      >
        {clearing ? 'Clearing…' : 'Clear offline copy'}
      </Button>
    </AppFact>
  );
}

/**
 * Quiet app controls: short build label, check for updates, offline clear.
 * Desktop uses two columns so actions stay compact. Install stays on More.
 */
export function AppInfoCard({ className, variant = 'card' }: AppInfoCardProps) {
  const version = formatAppVersionLabel(
    import.meta.env.VITE_APP_VERSION,
    import.meta.env.VITE_APP_DISPLAY_VERSION
  );

  return (
    <div
      className={cn(
        'space-y-3',
        variant === 'card' &&
          'border-border bg-card rounded-2xl border px-4 py-3 md:px-8 md:py-5 lg:px-10 lg:py-6',
        variant === 'embedded' && 'border-border/70 border-t pt-4',
        className
      )}
    >
      <p className="text-foreground text-sm font-semibold">App</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <AppFact label="Version" value={version}>
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
        </AppFact>

        <OfflineDataPanel />
      </div>
    </div>
  );
}
