import { useEffect, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { OrgPlanResponse } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { OrgPlanCheckoutReturn } from '@/features/dashboard/plans/lib/orgPlanCheckoutParams';
import {
  clearOrgPlanCheckoutSession,
  isOrgPlanCheckoutWatchExpired,
  readOrgPlanCheckoutSession,
  writeOrgPlanUpgradeCelebration,
} from '@/features/dashboard/plans/lib/orgPlanCheckoutSession';

import { captureAppEvent } from '@/lib/posthog/capture';

const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export type OrgPlanCheckoutConfirmationState =
  'idle' | 'confirming' | 'success' | 'cancelled' | 'timed_out';

type Options = {
  orgId: string | null;
  data: OrgPlanResponse | undefined;
  pollWhileConfirming: boolean;
  checkoutReturn?: OrgPlanCheckoutReturn | null;
  onCheckoutReturnHandled?: () => void;
};

/**
 * Polls org-plan after PayMongo Hosted Checkout until the webhook fulfills the subscription.
 */
export function useOrgPlanCheckoutConfirmation({
  orgId,
  data,
  pollWhileConfirming,
  checkoutReturn,
  onCheckoutReturnHandled,
}: Options): OrgPlanCheckoutConfirmationState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<OrgPlanCheckoutConfirmationState>('idle');
  const hadPendingCheckoutRef = useRef(false);
  const successHandledRef = useRef(false);
  const checkoutReturnHandledRef = useRef(false);

  const session = orgId ? readOrgPlanCheckoutSession(orgId) : null;
  const pendingCheckoutUrl = data?.pendingCheckoutUrl ?? null;
  const confirming =
    pollWhileConfirming &&
    Boolean(
      orgId &&
      // Only a checkout this browser started (or just returned from) is "being confirmed". An
      // open checkout left over from another device shows on the summary card instead.
      (session || checkoutReturn === 'success') &&
      state !== 'success' &&
      state !== 'cancelled' &&
      state !== 'timed_out'
    );

  useEffect(() => {
    if (!orgId || checkoutReturnHandledRef.current) return;

    if (checkoutReturn === 'cancelled') {
      checkoutReturnHandledRef.current = true;
      const checkoutSession = readOrgPlanCheckoutSession(orgId);
      captureAppEvent('org_plan_checkout_cancelled', {
        previous_plan_id: checkoutSession?.previousPlanId ?? 'none',
        target_plan_id: checkoutSession?.targetPlanId ?? 'unknown',
      });
      clearOrgPlanCheckoutSession(orgId);
      setState('cancelled');
      toast.message('Payment cancelled');
      onCheckoutReturnHandled?.();
      return;
    }

    if (checkoutReturn === 'success') {
      checkoutReturnHandledRef.current = true;
      setState('confirming');
      onCheckoutReturnHandled?.();
    }
  }, [checkoutReturn, orgId, onCheckoutReturnHandled]);

  useEffect(() => {
    if (state !== 'success') return;
    const timer = window.setTimeout(() => setState('idle'), 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!orgId || !data) return;

    if (pendingCheckoutUrl) {
      hadPendingCheckoutRef.current = true;
    }

    const sessionNow = readOrgPlanCheckoutSession(orgId);
    if (sessionNow && isOrgPlanCheckoutWatchExpired(sessionNow) && pendingCheckoutUrl) {
      captureAppEvent('org_plan_checkout_failed', {
        reason: 'timed_out',
        previous_plan_id: sessionNow.previousPlanId ?? 'none',
        target_plan_id: sessionNow.targetPlanId,
      });
      setState('timed_out');
      return;
    }

    // A payment that arrived after the plan had changed is kept as account credit, not applied:
    // say so instead of celebrating a plan change that did not happen.
    const creditedTransaction = data.transactions.find(
      (txn) => txn.status === 'paid' && txn.keptAsCredit && sessionNow?.transactionId === txn.id
    );
    if (creditedTransaction && sessionNow) {
      clearOrgPlanCheckoutSession(orgId);
      hadPendingCheckoutRef.current = false;
      setState('idle');
      toast.message('Payment received and added to your account credit', {
        description:
          'Your plan had already changed, so it was not applied. It comes off your next payment.',
      });
      void queryClient.invalidateQueries({ queryKey: ['org', orgId] });
      return;
    }

    const paidTransaction = data.transactions.find(
      (txn) =>
        txn.status === 'paid' &&
        txn.applied !== false &&
        (!sessionNow || txn.id === sessionNow.transactionId)
    );
    const subscriptionLive =
      data.subscription != null && LIVE_SUBSCRIPTION_STATUSES.has(data.subscription.status);
    const checkoutCleared = !pendingCheckoutUrl && hadPendingCheckoutRef.current;
    // A paid transaction is the proof. "Checkout closed and the plan is live" only counts once
    // this page has actually seen the checkout open, so a stale cache cannot fake a success.
    const fulfilled = Boolean(paidTransaction) || (checkoutCleared && subscriptionLive);

    if (fulfilled && !successHandledRef.current) {
      successHandledRef.current = true;
      const checkoutSession = readOrgPlanCheckoutSession(orgId);
      if (checkoutSession) {
        captureAppEvent('org_plan_checkout_completed', {
          previous_plan_id: checkoutSession.previousPlanId ?? 'none',
          target_plan_id: checkoutSession.targetPlanId,
        });
        // Paying for the plan you are already on (a renewal, or turning it back on) is not an
        // upgrade: a quiet confirmation, not confetti.
        if (checkoutSession.previousPlanId === checkoutSession.targetPlanId) {
          toast.success('Payment received');
        } else {
          writeOrgPlanUpgradeCelebration({
            orgId,
            previousPlanId: checkoutSession.previousPlanId,
            targetPlanId: checkoutSession.targetPlanId,
            fulfilledAt: Date.now(),
          });
        }
      }
      clearOrgPlanCheckoutSession(orgId);
      hadPendingCheckoutRef.current = false;
      setState('success');
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes('entitlements'),
      });
      void queryClient.invalidateQueries({ queryKey: ['org', orgId] });
      return;
    }

    if (sessionNow || checkoutReturn === 'success') {
      setState((current) =>
        current === 'success' || current === 'cancelled' || current === 'timed_out'
          ? current
          : 'confirming'
      );
    } else {
      // Functional update: with cached data this effect runs in the same commit as the
      // return-param effect above, so the `state` it closed over is stale and must not
      // overwrite a `cancelled` / `success` / `timed_out` that was just set.
      setState((current) =>
        current === 'success' || current === 'cancelled' || current === 'timed_out'
          ? current
          : 'idle'
      );
    }
  }, [checkoutReturn, data, orgId, pendingCheckoutUrl, queryClient]);

  return confirming ? 'confirming' : state;
}
