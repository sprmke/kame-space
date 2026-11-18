import { useLocation, useNavigate } from 'react-router-dom';

import { AlertTriangle } from 'lucide-react';

import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { canManageOrgBilling } from '@/features/dashboard/org/lib/orgAccessKind';
import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import { describeBillingBanner } from '@/features/dashboard/plans/lib/billingState';

import { Button } from '@/components/ui/button';
import { formatManilaLongDate } from '@/utils/format/dates';

/**
 * Overdue or suspended payment, on every admin page (org, property, parking). Paid features pause
 * but nothing is locked out: the dashboard keeps working like Free. Owners get a Pay button,
 * everyone else is told who to ask. Hidden on Plans & Billing, which says the same in full.
 */
export function BillingStatusBanner() {
  const orgId = useResolvedOrgId();
  const orgSlug = useOrgSlugParam();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useOrgPlan(orgId);
  const { data: orgs } = useOrganizations();
  const org = orgs?.organizations.find((entry) => entry.slug === orgSlug);

  if (!orgId || !orgSlug || !data) return null;
  if (location.pathname.endsWith('/plans')) return null;

  const banner = describeBillingBanner({
    subscription: data.subscription,
    canManage: canManageOrgBilling(org?.accessKind),
    formatDate: formatManilaLongDate,
  });
  if (!banner) return null;

  return (
    <div
      role="status"
      className="border-destructive/30 bg-destructive/5 mb-3 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-foreground text-sm">{banner.message}</p>
      </div>
      {banner.cta ? (
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] w-full shrink-0 sm:w-auto"
          onClick={() => navigate(`${orgPlansPath(orgSlug)}?tab=billing`)}
        >
          {banner.cta.label}
        </Button>
      ) : null}
    </div>
  );
}
