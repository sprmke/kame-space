import { useState } from 'react';

import { Check, Copy, Phone, ShieldCheck, Wifi } from 'lucide-react';
import { toast } from 'sonner';

import { GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';
import type { GuestTripEssentials } from '@/features/guest/trip/lib/guestTripApi';

import { Button } from '@/components/ui/button';
import { formatManilaDateTime } from '@/utils/format/dates';

/** Copy a value to the clipboard and confirm it. Falls back to a toast when unavailable. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy is not available on this device');
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0"
      aria-label={`Copy ${label.toLowerCase()}`}
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </Button>
  );
}

/** A secret that is not readable yet: say when it will be, never hint at the value. */
function HiddenUntil({ revealAt }: { revealAt: string }) {
  const label = formatManilaDateTime(revealAt);
  return (
    <span className="text-muted-foreground">
      {label ? `Available ${label}` : 'Available before check-in'}
    </span>
  );
}

function SecretRow({
  label,
  value,
  revealAt,
}: {
  label: string;
  value: string | null;
  /** Set while the value is withheld. */
  revealAt: string | null;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        {value ? (
          <>
            <span className="text-foreground truncate font-semibold tabular-nums">{value}</span>
            <CopyButton value={value} label={label} />
          </>
        ) : revealAt ? (
          <HiddenUntil revealAt={revealAt} />
        ) : (
          <span className="text-muted-foreground">Ask your host</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Wi-Fi, door code, unit, parking and contacts.
 *
 * Secrets render as "Available {date, time}" until the reveal time, which the server
 * enforces — the value simply is not in the payload before then (plan D7).
 */
export function GuestTripEssentialsCard({ essentials }: { essentials: GuestTripEssentials }) {
  if (!essentials.hasAny) return null;

  const wifiValue =
    essentials.wifiName && essentials.wifiPassword
      ? `${essentials.wifiName} / ${essentials.wifiPassword}`
      : (essentials.wifiName ?? essentials.wifiPassword);

  return (
    <GuestTripSection id="trip-essentials" title="Essentials">
      <dl className="divide-border/60 divide-y">
        {wifiValue ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
            <dt className="text-muted-foreground flex items-center gap-2">
              <Wifi className="size-4" aria-hidden />
              Wi-Fi
            </dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="text-foreground truncate font-semibold">{wifiValue}</span>
              <CopyButton value={wifiValue} label="Wi-Fi" />
            </dd>
          </div>
        ) : null}

        {essentials.hasDoorCode ? (
          <SecretRow
            label="Door code"
            value={essentials.doorCode}
            revealAt={essentials.revealAt}
          />
        ) : null}

        {essentials.unitFloor ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
            <dt className="text-muted-foreground">Unit</dt>
            <dd className="text-foreground text-right font-semibold">{essentials.unitFloor}</dd>
          </div>
        ) : null}

        {essentials.parkingSlotNote ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
            <dt className="text-muted-foreground">Parking</dt>
            <dd className="text-foreground text-right">{essentials.parkingSlotNote}</dd>
          </div>
        ) : null}

        {essentials.garbageSchedule ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
            <dt className="text-muted-foreground">Garbage</dt>
            <dd className="text-foreground text-right">{essentials.garbageSchedule}</dd>
          </div>
        ) : null}

        {essentials.quietHours ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-sm">
            <dt className="text-muted-foreground">Quiet hours</dt>
            <dd className="text-foreground text-right">{essentials.quietHours}</dd>
          </div>
        ) : null}
      </dl>

      {essentials.emergencyContactPhone || essentials.buildingSecurityPhone ? (
        <div className="mt-2 space-y-1">
          {essentials.emergencyContactPhone ? (
            <a
              href={`tel:${essentials.emergencyContactPhone.replace(/\s+/g, '')}`}
              className="hover:bg-muted/60 flex min-h-[52px] items-center gap-3 rounded-xl px-1 transition-colors"
            >
              <Phone className="text-foreground/70 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">
                  {essentials.emergencyContactName || 'Emergency contact'}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {essentials.emergencyContactPhone}
                </span>
              </span>
            </a>
          ) : null}
          {essentials.buildingSecurityPhone ? (
            <a
              href={`tel:${essentials.buildingSecurityPhone.replace(/\s+/g, '')}`}
              className="hover:bg-muted/60 flex min-h-[52px] items-center gap-3 rounded-xl px-1 transition-colors"
            >
              <ShieldCheck className="text-foreground/70 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">Building security</span>
                <span className="text-muted-foreground block text-xs">
                  {essentials.buildingSecurityPhone}
                </span>
              </span>
            </a>
          ) : null}
        </div>
      ) : null}
    </GuestTripSection>
  );
}
