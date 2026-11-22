import { useEffect, useRef } from 'react';

import { Link } from 'react-router-dom';

import { Building2 } from 'lucide-react';

import { GuestAccountContentCard } from '@/features/guest/account/components/GuestAccountContentCard';
import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  GuestVoucherWalletCard,
  GuestVoucherWalletIcon,
} from '@/features/guest/account/components/GuestVoucherUi';
import { useGuestVouchersQuery } from '@/features/guest/account/hooks/useGuestVouchersQuery';
import {
  guestAccountListLayoutFromCount,
  guestAccountListLayoutStorageKey,
  readGuestAccountListLayoutHint,
  resolveGuestAccountListLoadState,
  writeGuestAccountListLayoutHint,
} from '@/features/guest/account/lib/guestAccountListLayout';
import { formatVoucherOfferLabel } from '@/features/guest/account/lib/voucherDiscount';
import { guestFormPath } from '@/features/guest/lib/guestPublicPaths';

import {
  GuestAccountEmptyStateSkeleton,
  GuestVouchersPageSkeleton,
} from '@/components/skeletons/GuestAccountSkeletons';
import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/utils/format/bookingDisplay';

const LAYOUT_KEY = guestAccountListLayoutStorageKey('vouchers');

function WalletVoucherRow({
  propertyName,
  code,
  offer,
  meta,
  metaTitle,
  bookHref,
  active,
}: {
  propertyName: string;
  code: string;
  offer: string;
  meta?: string | null;
  metaTitle?: string | null;
  bookHref?: string;
  active: boolean;
}) {
  return (
    <GuestVoucherWalletCard active={active}>
      <div className={cn('flex items-center gap-2.5', active && 'pl-1.5')}>
        <GuestVoucherWalletIcon active={active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                'truncate font-mono text-sm font-bold tracking-wide',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {code}
            </p>
            <p
              className={cn(
                'shrink-0 text-xs font-semibold tabular-nums',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {offer}
            </p>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {propertyName}
            {meta ? (
              <>
                <span aria-hidden> · </span>
                <span title={metaTitle ?? undefined}>{meta}</span>
              </>
            ) : null}
          </p>
          {bookHref ? (
            <Link
              to={bookHref}
              className="text-primary mt-1.5 inline-flex min-h-[44px] items-center text-xs font-semibold underline-offset-4 hover:underline sm:min-h-0 sm:py-0.5"
            >
              Book again
            </Link>
          ) : null}
        </div>
      </div>
    </GuestVoucherWalletCard>
  );
}

export function GuestVouchersPage() {
  usePageTitle(publicPageTitle('Vouchers'));
  const { data, isLoading } = useGuestVouchersQuery({ includeRedeemed: true });
  const vouchers = data ?? [];
  const loadState = resolveGuestAccountListLoadState({
    isPending: isLoading,
    itemCount: data !== undefined ? data.length : undefined,
    hint: readGuestAccountListLayoutHint(LAYOUT_KEY),
    coldDefault: 'empty',
  });

  const available = vouchers.filter((v) => !v.redeemedAt);
  const used = vouchers.filter((v) => v.redeemedAt);

  useEffect(() => {
    if (loadState !== 'ready') return;
    writeGuestAccountListLayoutHint(LAYOUT_KEY, guestAccountListLayoutFromCount(vouchers.length));
  }, [loadState, vouchers.length]);

  // Once per page load, after the wallet has actually loaded. A wallet screen is the only
  // place a guest sees voucher value, so this is the outcome worth recording.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current || loadState !== 'ready') return;
    reportedRef.current = true;
    captureAppEvent('guest_voucher_viewed', {
      count: vouchers.length,
      available_count: available.length,
    });
  }, [available.length, loadState, vouchers.length]);

  if (loadState === 'empty') {
    return (
      <GuestAccountEmptyStateSkeleton mascotPose="voucher" ariaLabel="Loading vouchers" />
    );
  }

  if (loadState === 'list') {
    return (
      <GuestAccountContentCard>
        <GuestVouchersPageSkeleton rows={4} />
      </GuestAccountContentCard>
    );
  }

  if (vouchers.length === 0) {
    return (
      <GuestAccountEmptyState
        mascotPose="voucher"
        title="No vouchers yet"
        description="Rewards from stays will appear here when you earn them."
        actionLabel="Browse properties"
        actionIcon={Building2}
        actionHref="/properties"
      />
    );
  }

  return (
    <GuestAccountContentCard>
      <div className="space-y-5">
        {available.length > 0 ? (
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Ready to use
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {available.map((v) => {
                const offer = formatVoucherOfferLabel({
                  code: v.code,
                  percentOff: v.percentOff,
                  legacyAmountPhp: v.legacyAmountPhp,
                });
                const bookHref = v.propertySlug ? guestFormPath(v.propertySlug) : '/properties';
                return (
                  <li key={v.sourceBookingId}>
                    <WalletVoucherRow
                      active
                      propertyName={v.propertyName ?? 'Property'}
                      code={v.code}
                      offer={offer}
                      meta={v.awardedAt ? `Awarded ${formatRelative(v.awardedAt)}` : null}
                      metaTitle={v.awardedAt}
                      bookHref={bookHref}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {used.length > 0 ? (
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Used
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {used.map((v) => {
                const offer = formatVoucherOfferLabel({
                  code: v.code,
                  percentOff: v.percentOff,
                  legacyAmountPhp: v.legacyAmountPhp,
                });
                return (
                  <li key={v.sourceBookingId}>
                    <WalletVoucherRow
                      active={false}
                      propertyName={v.propertyName ?? 'Property'}
                      code={v.code}
                      offer={offer}
                      meta={v.redeemedAt ? `Used ${formatRelative(v.redeemedAt)}` : 'Used'}
                      metaTitle={v.redeemedAt}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </GuestAccountContentCard>
  );
}
