import { AlertCircle, Check, Minus } from 'lucide-react';

import {
  guestReadinessGaps,
  guestReadinessRows,
  type GuestReadinessRow,
} from '@/features/dashboard/guest-experience/lib/guestReadiness';
import { useGuestEssentialsQuery } from '@/features/dashboard/guest-experience/hooks/useGuestEssentials';
import { usePropertyTemplates } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TEMPLATE_KEYS = ['check-in-instructions', 'check-out-instructions'];

/** Scrolls to the settings section that owns a row. */
function scrollToSection(id: string) {
  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function RowIcon({ status }: { status: GuestReadinessRow['status'] }) {
  if (status === 'ready') return <Check className="text-success size-4" aria-hidden />;
  if (status === 'missing') return <AlertCircle className="text-warning size-4" aria-hidden />;
  return <Minus className="text-muted-foreground size-4" aria-hidden />;
}

/**
 * What a guest still has to go without (guest journey plan 7.2).
 *
 * A host cannot see their own gaps: the trip page falls back to default copy, or hides a
 * section that was never filled in. This lists them with a way to fix each one.
 */
export function GuestExperienceReadinessCard() {
  const templatesQuery = usePropertyTemplates();
  const essentialsQuery = useGuestEssentialsQuery();
  const settingsQuery = useAppSettings();

  const templates = templatesQuery.data?.templates ?? [];

  // A template counts as the host's own once a row exists and differs from the default.
  const isCustomised = (key: string) => {
    const template = templates.find((entry) => entry.templateKey === key);
    return Boolean(template && !template.isDefault);
  };

  const essentials = essentialsQuery.data;
  const hasEssentials = Boolean(
    essentials &&
      [
        essentials.wifiName,
        essentials.wifiPassword,
        essentials.doorCode,
        essentials.unitFloor,
        essentials.parkingSlotNote,
        essentials.emergencyContactPhone,
        essentials.buildingSecurityPhone,
      ].some((value) => value.trim().length > 0)
  );

  const rows = guestReadinessRows({
    checkInCustomised: isCustomised(TEMPLATE_KEYS[0]!),
    checkOutCustomised: isCustomised(TEMPLATE_KEYS[1]!),
    hasEssentials,
    paymentMethodCount: settingsQuery.data?.paymentMethods?.length ?? 0,
  });

  const gaps = guestReadinessGaps(rows);
  const isLoading = templatesQuery.isPending || essentialsQuery.isPending || settingsQuery.isPending;

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {isLoading
          ? 'Checking what your guests have…'
          : gaps.length > 0
            ? `${gaps.length} thing${gaps.length === 1 ? '' : 's'} missing for arriving guests.`
            : 'Everything arriving guests need is filled in.'}
      </p>

      <ul className="border-border/60 divide-border/60 divide-y rounded-xl border">
        {rows.map((row) => (
          <li key={row.id} className="flex min-h-[52px] items-center gap-3 px-3 py-2">
            <RowIcon status={row.status} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{row.label}</span>
              {row.hint ? (
                <span className="text-muted-foreground block text-xs">{row.hint}</span>
              ) : null}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('settings-action shrink-0')}
              onClick={() =>
                scrollToSection(
                  row.id === 'check-in' || row.id === 'check-out' || row.id === 'essentials'
                    ? 'guest-experience'
                    : row.id === 'payment'
                      ? 'payment'
                      : row.id
                )
              }
            >
              {row.status === 'check' ? 'Open' : row.status === 'ready' ? 'Edit' : 'Fix'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
