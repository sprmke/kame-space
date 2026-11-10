import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import { computeParkingDirectLinkNet } from '@/features/dashboard/parking/lib/parkingPayout';
import {
  STUB_COMMISSION_PCT,
  STUB_DIRECT_COMMISSION_PCT,
} from '@/features/dashboard/parking/lib/parkingPricingDefaults';

import { Button } from '@/components/ui/button';

type Props = {
  slug?: string;
  token?: string;
  commissionPct?: number;
  directCommissionPct?: number;
  /** Current weekday rate, used for the per-night savings example. */
  weekdayRate?: number;
};

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPhp(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function ParkingDirectLinkCard({
  slug,
  token,
  commissionPct = STUB_COMMISSION_PCT,
  directCommissionPct = STUB_DIRECT_COMMISSION_PCT,
  weekdayRate,
}: Props) {
  const url = slug && token ? `${window.location.origin}/parkings/${slug}/form?dl=${token}` : '';
  const directNet =
    weekdayRate !== undefined
      ? computeParkingDirectLinkNet(weekdayRate, directCommissionPct)
      : null;
  const standardNet =
    weekdayRate !== undefined ? computeParkingDirectLinkNet(weekdayRate, commissionPct) : null;

  const copy = () => {
    if (!url) return;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Could not copy link'));
  };

  return (
    <section className="surface-card p-4 sm:p-5">
      <div className="space-y-3">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold">Direct booking link</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Share this link and the platform fee is {formatPct(directCommissionPct)} instead of{' '}
            {formatPct(commissionPct)} per booking.
          </p>
          {directNet !== null && standardNet !== null ? (
            <p className="text-foreground mt-1 text-xs tabular-nums">
              Weekday: you receive {formatPhp(directNet)} instead of {formatPhp(standardNet)} per
              night.
            </p>
          ) : null}
        </div>
        {url ? (
          <p className="text-muted-foreground truncate font-mono text-xs" title={url}>
            {url}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full"
          disabled={!url}
          onClick={copy}
        >
          <Copy className="mr-1.5 h-4 w-4" aria-hidden />
          Copy link
        </Button>
        <p className="text-muted-foreground text-xs">Guests still sign in before booking.</p>
      </div>
    </section>
  );
}
